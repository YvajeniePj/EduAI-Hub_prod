import json
import time
import logging
import uuid
from typing import AsyncGenerator, Optional, Dict, Any, List

from app.services.ollama_client import chat_completion_with_tools
from app.services.agent.tools import execute_tool, get_tool_declarations_for_role
from app.services.agent.schemas import SSEEvent, AgentStep, AgentTrace, UserContext
from app.services.agent.session import AgentSession
from app.services.agent.prompts import build_system_prompt
from app.services.agent.permissions import is_tool_allowed
from app.services.guardrails import check_prompt_safety

logger = logging.getLogger(__name__)

MAX_STEPS = 8
TOTAL_TIMEOUT_SECONDS = 90


class AgentOrchestrator:
    """ReAct loop orchestrator for EduAI-Hub agent."""

    async def run(
        self,
        user_message: str,
        username: str,
        role: str,
        session: AgentSession,
        subject_id: Optional[str] = None,
    ) -> AsyncGenerator[SSEEvent, None]:
        """Run the agent loop, yielding SSE events.
        
        Flow:
        1. Check guardrails
        2. Build system prompt
        3. Load session history
        4. Get allowed tool declarations for role  
        5. Loop: call LLM -> execute tools -> repeat
        6. Yield final answer
        7. Save updated history to session
        """
        start_time = time.time()
        trace = AgentTrace(
            user_name=username,
            user_role=role,
            session_id=session.session_id,
            user_message=user_message,
        )

        # 1. Guardrail check
        is_safe, reason = check_prompt_safety(user_message)
        if not is_safe:
            yield SSEEvent(type="error", data={"message": reason, "guardrail_blocked": True})
            return

        # 2. Build system prompt
        system_prompt = build_system_prompt(username, role, subject_id)

        # 3. Load history + append new user message
        history = await session.get_history()
        messages = list(history)  # copy
        messages.append({"role": "user", "content": user_message})

        # 4. Get tool declarations
        tool_declarations = get_tool_declarations_for_role(role)

        yield SSEEvent(type="thinking", data={"message": "Анализирую запрос..."})

        # 5. ReAct loop
        final_answer = None
        for step_idx in range(MAX_STEPS):
            # Check total timeout
            elapsed = time.time() - start_time
            if elapsed > TOTAL_TIMEOUT_SECONDS:
                yield SSEEvent(type="error", data={"message": "Превышено время обработки запроса"})
                trace.error = "Total timeout exceeded"
                break

            # Call LLM
            try:
                llm_messages = [{"role": "system", "content": system_prompt}] + messages
                response = await chat_completion_with_tools(
                    messages=llm_messages,
                    tools=tool_declarations if tool_declarations else None,
                    temperature=0.3,
                )
            except Exception as e:
                logger.error(f"LLM call failed: {e}", exc_info=True)
                yield SSEEvent(type="error", data={"message": "Ошибка при обращении к языковой модели"})
                trace.error = str(e)
                break

            content = response.get("content")
            tool_calls = response.get("tool_calls")

            # Case A: LLM returns tool calls
            if tool_calls:
                # Add assistant message with tool calls to conversation
                assistant_msg = {"role": "assistant", "content": content or ""}
                if tool_calls:
                    assistant_msg["tool_calls"] = tool_calls
                messages.append(assistant_msg)

                for tc in tool_calls:
                    func = tc.get("function", {})
                    tool_name = func.get("name", "unknown")
                    tool_args = func.get("arguments", {})
                    
                    # Handle case where arguments is a string
                    if isinstance(tool_args, str):
                        try:
                            tool_args = json.loads(tool_args)
                        except json.JSONDecodeError:
                            tool_args = {}

                    # Yield tool_call event to frontend
                    yield SSEEvent(type="tool_call", data={
                        "name": tool_name,
                        "step": step_idx + 1
                    })

                    # Execute tool
                    step = AgentStep(step_index=step_idx)
                    step.tool_name = tool_name
                    step.tool_params = tool_args
                    tool_start = time.time()

                    tool_result = await execute_tool(
                        tool_name=tool_name,
                        arguments=tool_args,
                        username=username,
                        role=role,
                    )

                    step.tool_duration_ms = int((time.time() - tool_start) * 1000)
                    result_str = json.dumps(tool_result, ensure_ascii=False, default=str)
                    step.tool_result_summary = result_str[:300]
                    trace.steps.append(step)

                    # Yield tool result event
                    yield SSEEvent(type="tool_result", data={
                        "name": tool_name,
                        "summary": step.tool_result_summary[:200]
                    })

                    # Add tool result to messages for next LLM call
                    messages.append({
                        "role": "tool",
                        "content": result_str
                    })

                continue  # Next iteration - call LLM again with tool results

            # Case B: LLM returns text answer (final)
            if content:
                final_answer = content
                messages.append({"role": "assistant", "content": content})
                yield SSEEvent(type="answer", data={"text": content})
                break

            # Case C: No content and no tool calls — shouldn't happen
            logger.warning(f"LLM returned empty response at step {step_idx}")
            yield SSEEvent(type="error", data={"message": "Модель не смогла сформировать ответ"})
            trace.error = "Empty LLM response"
            break
        else:
            # Max steps exhausted
            yield SSEEvent(type="error", data={
                "message": "Достигнут максимум шагов обработки. Попробуйте уточнить вопрос."
            })
            trace.error = f"Max steps ({MAX_STEPS}) exhausted"

        # 6. Save history
        try:
            # Keep only user/assistant messages for history (not tool messages)
            history_messages = [
                m for m in messages
                if m.get("role") in ("user", "assistant") and m.get("content")
            ]
            await session.save_history(history_messages)
        except Exception as e:
            logger.error(f"Failed to save session: {e}")

        # 7. Finalize trace
        trace.final_answer = final_answer
        trace.total_duration_ms = int((time.time() - start_time) * 1000)

        yield SSEEvent(type="done", data={
            "steps": len(trace.steps),
            "duration_ms": trace.total_duration_ms,
            "session_id": session.session_id
        })

        # Log trace
        logger.info(
            f"Agent trace: user={username} role={role} steps={len(trace.steps)} "
            f"duration={trace.total_duration_ms}ms error={trace.error}"
        )

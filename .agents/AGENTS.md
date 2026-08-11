# EduAI-Hub Antigravity Agent Configuration & Skill Linking

## Active Skills & References

1. **`codebase-mapper`**: Map file located at [`.agents/codebase_map.md`](file:///c:/Users/zhiga/EduAI-Hub/.agents/codebase_map.md). Use for mapping FastAPI microservices and Angular 17 modules before making multi-file modifications.
2. **`ui-components`**: Reference UX patterns, layout structures, and accessibility from `~/.gemini/config/skills/ui-components/shadcn`. Apply modern design guidelines for Angular 17 + Material.
3. **`gemini-cookbook`**: Use official Google Gemini recipes from `~/.gemini/config/skills/gemini-cookbook` for LLM auto-grading and AI assistant microservices.
4. **`lms-auditor`**: Enforce security audits (Keycloak SSO, Peer Review anonymity), RxJS memory leak prevention, and performance quality.

## Project Architectural Rules

- **Frontend**: Angular 17+ with Standalone Components, RxJS reactive state, and Angular Material.
- **Backend**: FastAPI microservices (Python) + PostgreSQL + Redis + Keycloak SSO.
- **AI Services**: LLM integration via Gemini API with structured JSON outputs.

## Token Economy & Productivity Rules

- **No Whole-File Dumps**: Always edit via targeted line ranges (`replace_file_content` / `multi_replace_file_content`) to prevent burning output tokens on unchanged code.
- **Selective File Viewing**: Inspect specific line ranges (`StartLine`/`EndLine`) instead of dumping 800+ line files into context.
- **Consult Map First**: Look up microservices and Angular modules in [`.agents/codebase_map.md`](file:///c:/Users/zhiga/EduAI-Hub/.agents/codebase_map.md) before searching blindly.
- **Concise Response Synthesis**: Keep explanations focused and actionable without fluff or repetitive summaries.

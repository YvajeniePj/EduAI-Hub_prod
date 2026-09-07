import os
import subprocess
import logging
import asyncio
from pathlib import Path

logger = logging.getLogger(__name__)

async def convert_latex_to_pdf(tex_filepath: str) -> str | None:
    """
    Compiles a .tex file to PDF using xelatex.
    Returns the path to the compiled PDF if successful, otherwise None.
    Uses marker files to track status and temporary ASCII naming for robustness.
    """
    import re
    import shutil
    import uuid

    base_path = tex_filepath.rsplit(".", 1)[0]
    pdf_path = base_path + ".pdf"
    processing_file = pdf_path + ".processing"
    error_file = pdf_path + ".error"
    
    if os.path.exists(processing_file):
        return None
        
    Path(processing_file).touch()
    if os.path.exists(error_file):
        os.remove(error_file)
    # Remove potentially corrupt old PDF
    if os.path.exists(pdf_path):
        os.remove(pdf_path)
        
    work_dir = os.path.dirname(tex_filepath)
    # Use a safe ASCII filename for compilation to avoid TeX engine encoding issues
    temp_id = str(uuid.uuid4())[:8]
    work_tex = os.path.join(work_dir, f"work_{temp_id}.tex")
    work_pdf = os.path.join(work_dir, f"work_{temp_id}.pdf")
    
    logger.info(f"Starting LaTeX conversion for {tex_filepath}")
    try:
        # Read content with fallback encoding
        content = ""
        for encoding in ['utf-8', 'cp1251', 'latin1']:
            try:
                with open(tex_filepath, 'r', encoding=encoding) as f:
                    content = f.read()
                logger.info(f"Read .tex file using {encoding}")
                break
            except:
                continue
        
        if not content:
            raise Exception("Could not read .tex file with any supported encoding")

        # Inject robust preamble
        robust_code = r"""
% --- ROBUST PREAMBLE START ---
\usepackage{graphicx}
\usepackage{letltxmacro}
\usepackage{fontspec}
\setmainfont{DejaVu Serif}
\setsansfont{DejaVu Sans}
\setmonofont{DejaVu Sans Mono}
\LetLtxMacro\oldincludegraphics\includegraphics
\renewcommand{\includegraphics}[2][]{\IfFileExists{#2}{\oldincludegraphics[#1]{#2}}{\fbox{Missing Image: #2}}}
% --- ROBUST PREAMBLE END ---
"""
        # Inject just before \begin{document} for better package compatibility
        begin_doc_match = re.search(r"\\begin\{document\}", content)
        if begin_doc_match:
            insertion_point = begin_doc_match.start()
            content = content[:insertion_point] + robust_code + "\n" + content[insertion_point:]
            logger.info("Injected robust preamble before \\begin{document}")
        else:
            # Fallback: after \documentclass
            match = re.search(r"\\documentclass(?:\[[^\]]*\])?\{[^\}]+\}", content)
            if match:
                content = content[:match.end()] + robust_code + content[match.end():]
                logger.info("Injected robust preamble after \\documentclass")
            else:
                content = robust_code + content
                logger.info("Prepended robust preamble (no \\documentclass found)")
        
        # Write to temporary ASCII file
        with open(work_tex, 'w', encoding='utf-8') as f:
            f.write(content)

        # Execute xelatex
        process = await asyncio.create_subprocess_exec(
            "xelatex", "-interaction=nonstopmode", "-output-directory=" + work_dir, work_tex,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=180.0)
        except asyncio.TimeoutError:
            process.kill()
            logger.error(f"LaTeX compilation timed out")
            Path(error_file).write_text("Timeout during compilation")
            return None
        
        if os.path.exists(work_pdf) and os.path.getsize(work_pdf) > 100:
            if process.returncode != 0:
                logger.warning(f"LaTeX compilation finished with warnings (return code {process.returncode}), but PDF was generated.")
            os.replace(work_pdf, pdf_path)
            return pdf_path
        else:
            err_msg = stderr.decode(errors='ignore')
            # Extract meaningful error from log if possible
            log_file = work_tex.rsplit(".", 1)[0] + ".log"
            if os.path.exists(log_file):
                try:
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as lf:
                        log_content = lf.read()
                        # Find last 20 lines or error signs
                        err_msg += "\n--- LOG TAIL ---\n" + "\n".join(log_content.splitlines()[-30:])
                except:
                    pass
            
            logger.error(f"LaTeX compilation failed for {tex_filepath}")
            Path(error_file).write_text(err_msg)
            # Cleanup corrupt PDF if it exists
            if os.path.exists(work_pdf):
                os.remove(work_pdf)
            return None
            
    except Exception as e:
        logger.error(f"Error in LaTeX conversion pipeline: {e}")
        Path(error_file).write_text(str(e))
        return None
    finally:
        # Cleanup temporary TeX files
        for ext in ['.tex', '.aux', '.log', '.out', '.toc', '.pdf']:
            tmp_f = os.path.join(work_dir, f"work_{temp_id}{ext}")
            if os.path.exists(tmp_f) and tmp_f != pdf_path:
                try: os.remove(tmp_f)
                except: pass
        if os.path.exists(processing_file):
            os.remove(processing_file)


async def convert_jupyter_to_html(ipynb_filepath: str) -> str | None:
    """
    Converts a Jupyter notebook to HTML using nbconvert.
    Returns the path to the HTML file if successful, otherwise None.
    """
    base_path = ipynb_filepath.rsplit(".", 1)[0]
    html_path = base_path + ".html"
    processing_file = html_path + ".processing"
    error_file = html_path + ".error"
    
    if os.path.exists(processing_file):
        return None
        
    Path(processing_file).touch()
    if os.path.exists(error_file):
        os.remove(error_file)
        
    try:
        # jupyter nbconvert --to html file.ipynb
        process = await asyncio.create_subprocess_exec(
            "jupyter", "nbconvert", "--to", "html", ipynb_filepath,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=60.0)
        except asyncio.TimeoutError:
            process.kill()
            logger.error(f"Jupyter conversion timed out for {ipynb_filepath}")
            Path(error_file).write_text("Timeout")
            return None
            
        if process.returncode == 0:
            if os.path.exists(html_path):
                return html_path
                
        err_msg = stderr.decode()
        logger.error(f"Jupyter conversion failed: {err_msg}")
        Path(error_file).write_text(err_msg)
        return None
    except Exception as e:
        logger.error(f"Error converting Jupyter notebook: {e}")
        Path(error_file).write_text(str(e))
        return None
    finally:
        if os.path.exists(processing_file):
            os.remove(processing_file)


async def convert_docx_to_html(docx_filepath: str) -> str | None:
    """
    Converts a .docx document to clean, styled semantic HTML for direct preview.
    Supports paragraphs, bold/italic runs, headings, and tables.
    """
    base_path = docx_filepath.rsplit(".", 1)[0]
    html_path = base_path + ".html"
    processing_file = html_path + ".processing"
    error_file = html_path + ".error"
    
    if os.path.exists(processing_file):
        return None
        
    Path(processing_file).touch()
    if os.path.exists(error_file):
        try: os.remove(error_file)
        except: pass
        
    try:
        from docx import Document
        import html
        
        doc = Document(docx_filepath)
        html_parts = [
            "<!DOCTYPE html>",
            "<html><head><meta charset='utf-8'>",
            "<meta name='viewport' content='width=device-width, initial-scale=1.0'>",
            "<style>",
            "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.65; max-width: 860px; margin: 36px auto; padding: 0 24px; color: #18181b; background: #ffffff; }",
            "h1 { font-size: 26px; border-bottom: 2px solid #e4e4e7; padding-bottom: 8px; margin-top: 32px; color: #09090b; }",
            "h2 { font-size: 21px; margin-top: 26px; color: #09090b; }",
            "h3 { font-size: 17px; margin-top: 20px; color: #18181b; }",
            "p { margin: 12px 0; font-size: 15px; color: #27272a; word-wrap: break-word; }",
            "table { border-collapse: collapse; width: 100%; margin: 24px 0; font-size: 14px; }",
            "th, td { border: 1px solid #d4d4d8; padding: 10px 14px; text-align: left; vertical-align: top; }",
            "th { background: #f4f4f5; font-weight: 600; color: #09090b; }",
            "tr:nth-child(even) td { background: #fafafa; }",
            "ul, ol { padding-left: 24px; margin: 12px 0; }",
            "li { margin-bottom: 6px; font-size: 15px; }",
            "</style></head><body>"
        ]
        
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            
            p_html = ""
            for run in p.runs:
                run_text = html.escape(run.text)
                if run.bold and run.italic:
                    run_text = f"<strong><em>{run_text}</em></strong>"
                elif run.bold:
                    run_text = f"<strong>{run_text}</strong>"
                elif run.italic:
                    run_text = f"<em>{run_text}</em>"
                p_html += run_text
                
            style_name = (p.style.name or "").lower() if p.style else ""
            if "heading 1" in style_name or "заголовок 1" in style_name:
                html_parts.append(f"<h1>{p_html}</h1>")
            elif "heading 2" in style_name or "заголовок 2" in style_name:
                html_parts.append(f"<h2>{p_html}</h2>")
            elif "heading 3" in style_name or "заголовок 3" in style_name:
                html_parts.append(f"<h3>{p_html}</h3>")
            elif "list" in style_name or style_name.startswith("список"):
                html_parts.append(f"<ul><li>{p_html}</li></ul>")
            else:
                html_parts.append(f"<p>{p_html}</p>")
                
        for table in doc.tables:
            html_parts.append("<table>")
            for i, row in enumerate(table.rows):
                html_parts.append("<tr>")
                for cell in row.cells:
                    tag = "th" if i == 0 else "td"
                    cell_text = html.escape(cell.text.strip())
                    html_parts.append(f"<{tag}>{cell_text}</{tag}>")
                html_parts.append("</tr>")
            html_parts.append("</table>")
            
        html_parts.append("</body></html>")
        
        full_html = "\n".join(html_parts)
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(full_html)
            
        return html_path
    except Exception as e:
        logger.error(f"Error converting docx to html: {e}")
        Path(error_file).write_text(str(e))
        return None
    finally:
        if os.path.exists(processing_file):
            try: os.remove(processing_file)
            except: pass


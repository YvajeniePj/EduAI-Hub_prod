import os
import subprocess
import logging
import asyncio

logger = logging.getLogger(__name__)

async def convert_latex_to_pdf(tex_filepath: str) -> str | None:
    """
    Compiles a .tex file to PDF using tectonic.
    Returns the path to the compiled PDF if successful, otherwise None.
    """
    try:
        # tectonic file.tex
        process = await asyncio.create_subprocess_exec(
            "tectonic", tex_filepath,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            # tectonic generates PDF in the same directory by default
            pdf_path = tex_filepath.rsplit(".", 1)[0] + ".pdf"
            if os.path.exists(pdf_path):
                return pdf_path
        
        logger.error(f"LaTeX compilation failed: {stderr.decode()}")
        return None
    except Exception as e:
        logger.error(f"Error compiling LaTeX: {e}")
        return None


async def convert_jupyter_to_html(ipynb_filepath: str) -> str | None:
    """
    Converts a Jupyter notebook to HTML using nbconvert.
    Returns the path to the HTML file if successful, otherwise None.
    """
    try:
        # jupyter nbconvert --to html file.ipynb
        process = await asyncio.create_subprocess_exec(
            "jupyter", "nbconvert", "--to", "html", ipynb_filepath,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            html_path = ipynb_filepath.rsplit(".", 1)[0] + ".html"
            if os.path.exists(html_path):
                return html_path
                
        logger.error(f"Jupyter conversion failed: {stderr.decode()}")
        return None
    except Exception as e:
        logger.error(f"Error converting Jupyter notebook: {e}")
        return None

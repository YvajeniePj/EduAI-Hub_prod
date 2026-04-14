FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Install system dependencies for Tectonic, Pandoc and LaTeX
RUN apt-get update && apt-get install -y \
    curl \
    libfontconfig1 \
    libgraphite2-3 \
    libharfbuzz0b \
    libicu-dev \
    libssl-dev \
    pandoc \
    texlive-xetex \
    texlive-lang-cyrillic \
    texlive-fonts-recommended \
    texlive-latex-extra \
    cm-super \
    && curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
    && mv tectonic /usr/local/bin/ \
    && rm -rf /var/lib/apt/lists/*


# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8004

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004", "--reload"]


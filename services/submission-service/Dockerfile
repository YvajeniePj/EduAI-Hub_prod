FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Tectonic and Pandoc
RUN apt-get update && apt-get install -y \
    curl \
    libfontconfig1 \
    libgraphite2-3 \
    libharfbuzz0b \
    libicu-dev \
    libssl-dev \
    pandoc \
    && curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
    && mv tectonic /usr/local/bin/ \
    && rm -rf /var/lib/apt/lists/*


# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .
RUN mkdir -p static/avatars && chmod -R 777 static

# Expose port
EXPOSE 8003

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--reload"]


# Use official Python runtime as base image
FROM python:3.11-slim

# Set working directory in container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire videoServer directory
COPY . .

# Expose port 8080 (Cloud Run standard)
EXPOSE 8080

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the FastAPI server using Python module syntax
# Cloud Run uses port 8080 by default
CMD ["python", "-m", "uvicorn", "server_:app", "--host", "0.0.0.0", "--port", "8080"]

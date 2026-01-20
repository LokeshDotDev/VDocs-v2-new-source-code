FROM python:3.11-slim

WORKDIR /app


# Install system dependencies for OpenCV (cv2)
RUN apt-get update && apt-get install -y \
	libglib2.0-0 \
	libsm6 \
	libxrender1 \
	libxext6 \
	libxcb1 \
	&& rm -rf /var/lib/apt/lists/*

COPY python-manager/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY reductor-module /app/reductor-module

ENV PORT=5000
EXPOSE 5000

CMD ["python", "main.py"]

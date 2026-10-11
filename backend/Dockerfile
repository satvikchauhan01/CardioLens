# The model service: FastAPI with the trained models from backend/artifacts.
# Built and started by docker-compose.yml in the repository root.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Only what the service needs at run time: no test tools and no dataset.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY ml ./ml
COPY artifacts ./artifacts

RUN useradd --create-home --shell /usr/sbin/nologin cardiolens
USER cardiolens

EXPOSE 8000
# The web container reaches the service by its name, so it listens on every interface of the container.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

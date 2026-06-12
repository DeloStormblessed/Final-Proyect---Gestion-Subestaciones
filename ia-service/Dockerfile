FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Caché del modelo de embeddings DENTRO de /app: el default (/tmp) puede ser
# tmpfs en la plataforma de deploy y perderse entre build y runtime.
ENV FASTEMBED_CACHE_PATH=/app/fastembed_cache

# Pre-indexa la normativa en el BUILD (requisito: documentos pre-indexados).
# Descarga el modelo de embeddings y deja chroma_db/ horneado en la imagen:
# el contenedor arranca listo, sin depender de red ni de un volumen externo.
RUN python scripts/indexar_normativa.py

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

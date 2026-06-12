"""
Capa RAG: configuración compartida del vector store (Chroma persistente) y de
los embeddings (fastembed/ONNX, locales y sin API key — Groq no ofrece embeddings).

El modelo es multilingüe porque las fichas de normativa están en español; un
modelo solo-inglés degradaría notablemente el retrieval.

La usan dos consumidores:
  - scripts/indexar_normativa.py (indexación, se ejecuta una vez)
  - agent/tools/rag_tool.py (búsqueda en cada consulta del agente)
"""

from pathlib import Path

from langchain_chroma import Chroma
from langchain_community.embeddings import FastEmbedEmbeddings

RAIZ_SERVICIO = Path(__file__).resolve().parents[1]
DIR_NORMATIVA = RAIZ_SERVICIO / "docs" / "normativa"
# "chroma_db": el nombre que el .gitignore raíz ya excluye para el vector store
DIR_CHROMA = str(RAIZ_SERVICIO / "chroma_db")
COLECCION = "normativa"
MODELO_EMBEDDINGS = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# Singleton perezoso: el modelo ONNX tarda en cargar (y se descarga la primera
# vez); debe ocurrir una sola vez por proceso, no por consulta.
_vectorstore: Chroma | None = None


def get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            collection_name=COLECCION,
            persist_directory=DIR_CHROMA,
            embedding_function=FastEmbedEmbeddings(model_name=MODELO_EMBEDDINGS),
        )
    return _vectorstore

"""
Indexa las fichas de normativa (docs/normativa/*.md) en la colección Chroma.

Ejecutar desde ia-service/:  python scripts/indexar_normativa.py

Idempotente: borra y reconstruye la colección entera en cada ejecución. Con un
corpus de este tamaño (7 fichas) la reindexación completa tarda segundos y evita
duplicados o restos de versiones anteriores de los documentos.

Troceado por secciones "##" del markdown (MarkdownHeaderTextSplitter): cada
sección de una ficha es un chunk autocontenido de ~100-250 tokens, el tamaño
que queremos inyectar al LLM. La fuente normativa viaja en los metadatos para
que el agente pueda citar.
"""

import sys
from pathlib import Path

# Permite ejecutar el script desde ia-service/ sin instalar el paquete
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from langchain_core.documents import Document
from langchain_text_splitters import MarkdownHeaderTextSplitter

from agent.rag import COLECCION, DIR_CHROMA, DIR_NORMATIVA, get_vectorstore


def parsear_frontmatter(texto: str) -> tuple[dict, str]:
    """Frontmatter YAML simple (clave: valor) delimitado por '---'."""
    if not texto.startswith("---"):
        return {}, texto
    _, fm, cuerpo = texto.split("---", 2)
    meta = {}
    for linea in fm.strip().splitlines():
        clave, _, valor = linea.partition(":")
        if clave.strip():
            meta[clave.strip()] = valor.strip()
    return meta, cuerpo.strip()


def cargar_chunks() -> list[Document]:
    # strip_headers=False: sin los títulos, el embedding pierde justo las palabras
    # con más carga semántica (p.ej. "Periodicidades de inspección" desaparecía y
    # la sección quedaba en bullets sin la palabra "inspección" — retrieval roto).
    splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "documento"), ("##", "seccion")],
        strip_headers=False,
    )
    chunks: list[Document] = []
    ficheros = sorted(DIR_NORMATIVA.glob("*.md"))
    if not ficheros:
        raise SystemExit(f"No hay fichas en {DIR_NORMATIVA}")

    for fichero in ficheros:
        meta, cuerpo = parsear_frontmatter(fichero.read_text(encoding="utf-8"))
        for doc in splitter.split_text(cuerpo):
            # La fuente normativa (UNE/IEC/RD/procedimiento) es lo que el agente
            # citará en sus respuestas: requisito del enunciado.
            doc.metadata["fuente"] = meta.get("fuente", fichero.stem)
            doc.metadata["titulo"] = meta.get("titulo", "")
            # Línea de contexto antepuesta: cada chunk se embebe (y se lee) sabiendo
            # de qué documento sale, aunque la sección por sí sola sea ambigua.
            doc.page_content = f"({meta.get('titulo', '')})\n{doc.page_content}"
            chunks.append(doc)
        print(f"  {fichero.name}: {meta.get('fuente', '?')}")

    return chunks


def main():
    print(f"Cargando fichas de {DIR_NORMATIVA} …")
    chunks = cargar_chunks()
    print(f"{len(chunks)} chunks generados.")

    print("Generando embeddings e indexando (la primera vez descarga el modelo)…")
    vs = get_vectorstore()
    # Reconstrucción limpia con el MISMO cliente (dos clientes sobre el mismo
    # directorio pueden chocar): borra y recrea la colección vacía.
    vs.reset_collection()
    vs.add_documents(chunks)
    print(f"OK: {len(chunks)} chunks indexados en '{COLECCION}' ({DIR_CHROMA})")


if __name__ == "__main__":
    main()

"""
Tool RAG: búsqueda semántica sobre las fichas de normativa indexadas en Chroma.

A diferencia de las tools de dominio, no necesita JWT: la normativa es
conocimiento estático del servicio, no datos del usuario. Cada fragmento se
devuelve encabezado por su fuente — el agente tiene instrucción de citar esas
fuentes en la respuesta (requisito del enunciado).
"""

from langchain_core.tools import tool

from agent.rag import get_vectorstore

# k=4: las preguntas comparativas ("preventivo vs correctivo") necesitan
# fragmentos de varias secciones a la vez. ~200 tokens/chunk → ~800 por consulta.
NUM_FRAGMENTOS = 4


@tool
def buscar_normativa(consulta: str) -> str:
    """
    Busca en la documentación normativa de mantenimiento indexada: terminología
    UNE-EN 13306, designación de activos IEC 81346-2, inspecciones reglamentarias
    ITC-RAT 23, descargos y reglas de oro RD 614/2001, mantenimiento de
    transformadores y pararrayos, y el plan interno de periodicidades PM-01.
    Usar para preguntas de normativa, definiciones, procedimientos o criterios
    de mantenimiento (NO para datos de activos concretos del sistema).
    Devuelve fragmentos encabezados por [fuente]: cítalas en la respuesta.
    """
    vs = get_vectorstore()
    docs = vs.similarity_search(consulta, k=NUM_FRAGMENTOS)
    if not docs:
        return "No se encontró normativa relevante para esa consulta."

    partes = []
    for d in docs:
        fuente = d.metadata.get("fuente", "fuente desconocida")
        seccion = d.metadata.get("seccion", "")
        ref = fuente + (f", {seccion}" if seccion else "")
        partes.append(f"[{ref}]\n{d.page_content}")
    return "\n\n".join(partes)


RAG_TOOLS = [buscar_normativa]

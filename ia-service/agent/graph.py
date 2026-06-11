"""
Grafo LangGraph del asistente de mantenimiento.

Arquitectura: ReAct (Reason + Act) con dos tools en esta capa:
  - DOMAIN_TOOLS: consultan la API de Node (activos, OTs, dashboard)
  - RAG_TOOLS: se añaden en la capa de RAG (normativa UNE/IEC) — pendiente

Memoria: AsyncPostgresSaver con AsyncConnectionPool persiste el historial por
thread_id en el Postgres compartido. El pool se inicializa una vez al arrancar
FastAPI (lifespan) y se cierra al apagar. Python gestiona sus propias tablas;
Node no las toca.
"""

from langchain_groq import ChatGroq
from langchain_core.messages import trim_messages
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from config import settings
from agent.tools.domain_tool import DOMAIN_TOOLS

SYSTEM_PROMPT = """Eres un asistente experto en mantenimiento de subestaciones eléctricas.
Tienes acceso a la base de datos real del sistema GMAO a través de tus herramientas.

Usa las herramientas SOLO cuando la pregunta trate sobre activos, órdenes de trabajo,
inspecciones o el estado del sistema. Para saludos, preguntas generales o conversación
informal, responde directamente sin invocar ninguna herramienta.

Responde en español, de forma clara y técnica. Si usas datos del sistema, menciona
los códigos de los activos y las fechas relevantes para que la respuesta sea precisa.

Herramientas disponibles:
- listar_activos: para ver activos con filtros por estado, tipo o inspección vencida
- detalle_activo: para ver el detalle completo de un activo y su historial de OTs
- listar_ordenes_trabajo: para consultar órdenes de trabajo recientes
- dashboard_kpis: para obtener el resumen ejecutivo del sistema
"""


def _conn_string() -> str:
    # psycopg requiere "postgresql+psycopg://" o simplemente la cadena de psycopg
    url = settings.database_url
    # Prisma usa "postgresql://"; psycopg_pool acepta el mismo formato
    return url


async def init_checkpointer() -> tuple[AsyncConnectionPool, AsyncPostgresSaver]:
    """
    Crea el pool de conexiones y el checkpointer de LangGraph.
    Llamar una vez en el lifespan de FastAPI; reutilizar el mismo objeto.

    - from_conn_string usa autocommit=True (necesario para CREATE INDEX CONCURRENTLY)
    - El pool se usa para las operaciones normales de lectura/escritura
    """
    conn_str = _conn_string()

    # Setup con autocommit — CREATE INDEX CONCURRENTLY no puede correr en transacción
    async with AsyncPostgresSaver.from_conn_string(conn_str) as temp:
        await temp.setup()

    # Pool persistente para el uso normal durante la vida del servidor
    pool = AsyncConnectionPool(conninfo=conn_str, max_size=10, open=False)
    await pool.open()
    checkpointer = AsyncPostgresSaver(pool)

    return pool, checkpointer


def build_agent(checkpointer: AsyncPostgresSaver):
    """Construye el agente ReAct con el checkpointer inyectado."""
    llm = ChatGroq(
        model=settings.groq_model,
        api_key=settings.groq_api_key,
        temperature=0,
    )

    def _trim(messages):
        # token_counter=llm usa get_num_tokens_from_messages() vía tiktoken,
        # que es la mejor aproximación disponible para Llama 3 sin tokenizador oficial.
        # 3 500 tokens reservados para historial deja margen para tool schemas (~1 500)
        # y system prompt (~350) dentro del límite de Groq sin desperdiciar contexto.
        # Los ToolMessages viejos (los más pesados) se descartan primero (strategy="last").
        # El checkpointer los conserva en Postgres para el historial de la UI.
        return trim_messages(
            messages,
            max_tokens=3500,
            strategy="last",
            token_counter=llm,
            include_system=True,
            allow_partial=False,
        )

    return create_react_agent(
        model=llm,
        tools=DOMAIN_TOOLS,
        checkpointer=checkpointer,
        state_modifier=SYSTEM_PROMPT,
        messages_modifier=_trim,
    )

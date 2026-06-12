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
from langchain_core.messages import trim_messages, SystemMessage
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from config import settings
from agent.tools.domain_tool import DOMAIN_TOOLS

SYSTEM_PROMPT = """Eres un asistente experto en mantenimiento de subestaciones eléctricas.
Tienes acceso a la base de datos real del sistema GMAO a través de tus herramientas.

Para saludos y conversación general responde directamente, sin herramientas. Pero para
CUALQUIER dato del sistema (activos, órdenes de trabajo, inspecciones, KPIs) usa SIEMPRE
las herramientas: nunca respondas de memoria ni inventes datos del sistema.

El estado de un activo tiene dos ejes independientes:
- cicloVida: OPERATIVO | DADO_DE_BAJA (la baja es terminal, sin retorno)
- disponibilidad: EN_SERVICIO | AVERIADO | FUERA_DE_SERVICIO — solo relevante si el
  activo está OPERATIVO. FUERA_DE_SERVICIO equivale a "en descargo" en jerga del sector.

Responde en español, de forma clara y técnica. Si usas datos del sistema, menciona
los códigos de los activos y las fechas relevantes para que la respuesta sea precisa.

Herramientas disponibles:
- listar_activos: para ver activos con filtros por ciclo de vida, disponibilidad,
  tipo o inspección vencida
- detalle_activo: para ver el detalle completo de un activo y su historial de OTs
- listar_ordenes_trabajo: para consultar órdenes de trabajo recientes
- dashboard_kpis: para obtener el resumen ejecutivo del sistema
"""

# Presupuesto de historial enviado al modelo por turno. ~4 chars/token de
# aproximación: 4000 tokens ≈ 16000 chars de historial + ~1500 de tool schemas
# + ~350 de system prompt, holgado dentro del rate-limit por minuto de Groq.
MAX_TOKENS_HISTORIAL = 4000


def _contar_tokens_aprox(msgs) -> int:
    # Aproximación ~4 chars/token: no requiere transformers ni tiktoken.
    return sum(len(str(getattr(m, "content", ""))) // 4 for m in msgs)


def _preparar_mensajes(state):
    """
    state_modifier del agente: recorta el historial antes de cada llamada al LLM.
    El checkpointer conserva el historial COMPLETO en Postgres (para la UI);
    aquí solo se limita lo que viaja al modelo en cada turno.

    OJO: en LangGraph 0.2.x un state_modifier callable recibe el STATE completo
    (dict con "messages"), no la lista de mensajes. Pasarle una función que
    espera la lista fue lo que rompió el intento anterior de trim.
    """
    conversacion = [
        m for m in state["messages"] if not isinstance(m, SystemMessage)
    ]

    # start_on="human" garantiza que el historial recortado empieza en un mensaje
    # de usuario: nunca queda un ToolMessage huérfano de su AIMessage(tool_calls),
    # que Groq rechaza con un 400. Ese era el otro fallo del intento anterior.
    recortados = trim_messages(
        conversacion,
        max_tokens=MAX_TOKENS_HISTORIAL,
        strategy="last",
        token_counter=_contar_tokens_aprox,
        start_on="human",
        allow_partial=False,
    )

    # Salvaguarda: si un único mensaje excede el presupuesto, trim_messages
    # devuelve lista vacía y el LLM fallaría sin input. Mejor enviar el último
    # tramo de conversación que no enviar nada.
    if not recortados:
        recortados = conversacion[-1:]

    return [SystemMessage(content=SYSTEM_PROMPT)] + recortados


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

    return create_react_agent(
        model=llm,
        tools=DOMAIN_TOOLS,
        checkpointer=checkpointer,
        state_modifier=_preparar_mensajes,
    )

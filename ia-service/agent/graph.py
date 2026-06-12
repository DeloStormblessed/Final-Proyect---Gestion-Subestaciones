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

# Prompt deliberadamente compacto: viaja en CADA llamada al LLM (2-3 por turno).
# Aquí solo van reglas de COMPORTAMIENTO (ámbito, cuándo usar tools, formato).
# El mapeo lenguaje→filtros derivado del schema Prisma vive en los docstrings de
# las tools (que el modelo también recibe en cada llamada): repartir sin duplicar.
SYSTEM_PROMPT = """Eres el asistente del GMAO de subestaciones eléctricas. Tu ÚNICO ámbito
son los datos del sistema: subestaciones, activos, órdenes de trabajo, inspecciones y KPIs.

Reglas:
- Pregunta fuera de ese ámbito (cualquier otro tema): responde en UNA frase que solo
  puedes ayudar con el mantenimiento del sistema. Sin herramientas.
- Saludos o cortesía: responde breve, sin herramientas.
- Datos del sistema: SIEMPRE con herramientas, nunca de memoria. Responde SOLO con lo
  que devuelvan; si algo no consta en la base de datos, dilo.
- Preguntas de "¿cuántos…?": usa solo_contar=true o dashboard_kpis; NO listes para contar.
- Elige el filtro más específico posible en la PRIMERA llamada; evita llamadas de tanteo.
- Sé breve y directo. Responde en español citando códigos y fechas del sistema.
"""

# Presupuesto de historial enviado al modelo por turno. ~4 chars/token de
# aproximación: 2000 tokens ≈ 8000 chars. El asistente responde consultas
# puntuales; no necesita historial profundo, y cada token del historial se
# paga en TODAS las llamadas del turno (el tier gratuito de Groq tiene un
# límite de tokens/minuto que una sola pregunta puede agotar).
MAX_TOKENS_HISTORIAL = 2000


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

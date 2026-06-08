from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from agent.graph import init_checkpointer, build_agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa el pool de Postgres y el agente al arrancar; los cierra al parar."""
    pool, checkpointer = await init_checkpointer()
    app.state.agent = build_agent(checkpointer)
    app.state.db_pool = pool
    yield
    await pool.close()


app = FastAPI(
    title="Asistente de Mantenimiento — IA Service",
    description="Agente LangGraph con RAG sobre normativa y consulta de dominio vía API de Node.",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [settings.allowed_origin] if settings.allowed_origin else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.chat import router as chat_router  # noqa: E402 — importar después de lifespan
app.include_router(chat_router)


@app.get("/health")
def health():
    return {"status": "ok"}

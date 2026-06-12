import logging
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from langgraph.errors import GraphRecursionError
from pydantic import BaseModel

from middleware.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])

logger = logging.getLogger("ia-service.chat")


def _log_telemetria_turno(mensajes):
    """
    Telemetría del turno: cuántas llamadas al LLM hubo, qué tool pidió cada una
    (con argumentos) y los tokens de entrada/salida que reporta Groq. Una pregunta
    simple con una tool deberían ser 2 llamadas: si salen más, aquí se ve si fue
    un argumento erróneo, una tool de más o historial inflado.
    """
    # El state devuelve el hilo completo; el turno actual es lo que sigue al
    # último mensaje humano (el que acaba de enviar el usuario).
    idx = max((i for i, m in enumerate(mensajes) if m.type == "human"), default=0)
    n_llamada = 0
    total_in = total_out = 0
    for m in mensajes[idx:]:
        if m.type != "ai":
            continue
        n_llamada += 1
        uso = getattr(m, "usage_metadata", None) or {}
        total_in += uso.get("input_tokens", 0)
        total_out += uso.get("output_tokens", 0)
        tools = [
            f"{tc['name']}({tc.get('args', {})})"
            for tc in (getattr(m, "tool_calls", None) or [])
        ]
        logger.info(
            "LLM call %d: in=%s out=%s -> %s",
            n_llamada,
            uso.get("input_tokens", "?"),
            uso.get("output_tokens", "?"),
            "; ".join(tools) if tools else "respuesta final",
        )
    logger.info(
        "Turno completo: %d llamadas, %d tokens de entrada, %d de salida",
        n_llamada, total_in, total_out,
    )


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None  # None = usa "{user_id}-default"


class ChatResponse(BaseModel):
    respuesta: str
    conversation_id: str


@router.post("", response_model=ChatResponse)
async def chat(
    request: Request,
    body: ChatRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Envía un mensaje al agente y recibe su respuesta.
    El JWT del usuario se reenvía a la API de Node para que el agente
    responda según los permisos del usuario autenticado.
    """
    conversation_id = body.conversation_id or f"{current_user['id']}-default"

    try:
        agent = request.app.state.agent

        # El JWT viaja en configurable para que los tools lo reenvíen a Node
        config = {
            "configurable": {
                "thread_id": conversation_id,
                "jwt_token": current_user.get("__raw_token", ""),
            },
            # Tope de seguridad contra bucles tool→error→reintento, con margen
            # para 4-5 ciclos LLM+tool legítimos. Con 6 era tan justo que cualquier
            # reintento de tool agotaba el límite y el endpoint devolvía 500.
            "recursion_limit": 10,
        }

        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": body.message}]},
            config=config,
        )

        _log_telemetria_turno(result["messages"])

        respuesta = result["messages"][-1].content
        return ChatResponse(respuesta=respuesta, conversation_id=conversation_id)

    except GraphRecursionError:
        # El agente entró en bucle (p.ej. una tool fallando repetidamente).
        # Respuesta degradada en vez de 500: el chat de la UI sigue funcionando.
        return ChatResponse(
            respuesta=(
                "No he podido completar la consulta: el sistema necesitó demasiados "
                "pasos para responder. Prueba a reformular la pregunta o acotarla."
            ),
            conversation_id=conversation_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del agente: {str(e)}")


@router.get("/history/{conversation_id}")
async def get_history(
    request: Request,
    conversation_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Devuelve el historial de una conversación (solo mensajes usuario/asistente).
    """
    try:
        agent = request.app.state.agent
        config = {"configurable": {"thread_id": conversation_id}}
        state = await agent.aget_state(config)

        if not state or not state.values:
            return {"conversation_id": conversation_id, "mensajes": []}

        mensajes = []
        for msg in state.values.get("messages", []):
            role = getattr(msg, "type", None) or msg.__class__.__name__.lower()
            if role in ("human", "ai"):
                mensajes.append({
                    "rol": "usuario" if role == "human" else "asistente",
                    "contenido": msg.content,
                })

        return {"conversation_id": conversation_id, "mensajes": mensajes}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al recuperar historial: {str(e)}")

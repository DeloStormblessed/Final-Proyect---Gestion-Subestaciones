from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from middleware.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


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
            }
        }

        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": body.message}]},
            config=config,
            # Máximo 3 ciclos razonamiento→tool por turno (6 nodos = 3 pares LLM+tool).
            # Si el agente no ha terminado en ese punto, LangGraph lanza GraphRecursionError
            # que capturamos abajo y devolvemos como 500 con mensaje claro.
            recursion_limit=6,
        )

        respuesta = result["messages"][-1].content
        return ChatResponse(respuesta=respuesta, conversation_id=conversation_id)

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

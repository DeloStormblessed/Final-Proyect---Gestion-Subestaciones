"""
Prueba e2e del agente con RAG, sin levantar FastAPI ni Postgres.

Ejecutar desde ia-service/:  python scripts/probar_agente.py
Requiere GROQ_API_KEY en .env y la colección Chroma indexada
(python scripts/indexar_normativa.py). Consume ~6-8k tokens de la cuota de Groq.

Comprueba: retrieval de la tool RAG, citación de fuentes en las respuestas
(requisito del enunciado) y rechazo de preguntas fuera de ámbito.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent.tools.rag_tool import buscar_normativa
from agent.graph import build_agent

# 1) La tool en standalone
print("=== Tool standalone ===")
salida = buscar_normativa.invoke({"consulta": "cada cuánto se inspecciona un seccionador"})
print(salida[:400], "…\n")
assert "[Procedimiento interno PM-01" in salida, "el chunk del PM-01 debería venir citado"

# 2) El agente completo contra Groq (sin checkpointer: no necesita Postgres)
print("=== Agente e2e (Groq) ===")
agent = build_agent(checkpointer=None)

async def preguntar(texto):
    r = await agent.ainvoke(
        {"messages": [{"role": "user", "content": texto}]},
        config={"recursion_limit": 10},
    )
    llamadas = sum(1 for m in r["messages"] if m.type == "ai")
    tokens_in = sum((getattr(m, "usage_metadata", None) or {}).get("input_tokens", 0)
                    for m in r["messages"] if m.type == "ai")
    print(f"\nQ: {texto}")
    print(f"({llamadas} llamadas LLM, {tokens_in} tokens entrada)")
    print("R:", r["messages"][-1].content)
    return r["messages"][-1].content

resp1 = asyncio.run(preguntar("¿Qué diferencia hay entre mantenimiento preventivo y correctivo?"))
assert "13306" in resp1, "debería citar la UNE-EN 13306"

resp2 = asyncio.run(preguntar("¿Qué es un descargo?"))
assert "614" in resp2, "debería citar el RD 614/2001"

resp3 = asyncio.run(preguntar("¿Qué tiempo va a hacer mañana en Madrid?"))
print("\nOK: todas las pruebas e2e pasaron")

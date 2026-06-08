"""
Script de arranque del servicio IA. Sirve para local (Windows) y producción (Railway).
psycopg async requiere SelectorEventLoop; Windows usa ProactorEventLoop por defecto.
"""
import asyncio
import os
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    es_local = "PORT" not in os.environ
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=es_local)

"""
Script de arranque para Windows.
psycopg async requiere SelectorEventLoop; Windows 3.8+ usa ProactorEventLoop por defecto.
"""
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

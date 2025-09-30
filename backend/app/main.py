from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import time
import logging

from .routes.message import router as message_router
from .routes.fact import router as fact_router
from .routes.chat import router as chat_router
from .routes.trajectory import router as trajectory_router
from .routes.skills import router as skills_router
from .routes.summary_chat import router as summary_chat_router
from .routes.meta import router as meta_router
from .routes.admin import router as admin_router
from .database import Base, engine, SessionLocal
from .models import *  # noqa: F401,F403 ensure tables are registered
from .prompt_migration import migrate_prompts

app = FastAPI(title="Mriya API")

# --- Middleware to log execution time of every request ---

import logging, time
logger = logging.getLogger("uvicorn.error")  # default handler/format
logger.setLevel(logging.INFO)

@app.middleware("http")
async def add_timing_log(request, call_next):
    start = time.perf_counter()
    resp = await call_next(request)
    dur = time.perf_counter() - start
    logger.info("%s %s %.3f s", request.method, request.url.path, dur)
    return resp

# Разрешаем обращение к API с фронтенда (localhost:5173 по умолчанию у Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # При необходимости ограничьте домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(message_router)
app.include_router(fact_router)
app.include_router(chat_router)
app.include_router(trajectory_router)
app.include_router(skills_router)
app.include_router(summary_chat_router)
app.include_router(meta_router)
app.include_router(admin_router)

# Точка входа для запуска через `python -m backend.app.main`
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

@app.on_event("startup")
def on_startup():
    """Create tables and migrate prompts."""
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        migrate_prompts(db)

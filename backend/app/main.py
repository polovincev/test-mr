from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.message import router as message_router
from .routes.fact import router as fact_router
from .routes.chat import router as chat_router
from .routes.trajectory import router as trajectory_router
from .routes.skills import router as skills_router
from .routes.summary_chat import router as summary_chat_router

app = FastAPI(title="Mriya API")

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

# Точка входа для запуска через `python -m backend.app.main`
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

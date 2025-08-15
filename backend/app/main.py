from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.message import router as message_router

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

# Точка входа для запуска через `python -m backend.app.main`
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

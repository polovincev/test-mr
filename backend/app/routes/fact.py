from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter(tags=["fact"])


class FactResponse(BaseModel):
    content: str


@router.get("/fact", response_model=FactResponse)
async def read_fact() -> FactResponse:  # noqa: D401
    """Возвращает факт дня (пока статическая строка)."""
    return FactResponse(content="Факт дня")



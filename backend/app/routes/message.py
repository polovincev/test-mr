from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..entities.message import Message
from ..use_cases.get_message import GetMessageUseCase, get_message_use_case

router = APIRouter(tags=["message"])


class MessageResponse(BaseModel):
    """Модель ответа на фронтенд."""

    content: str


@router.get("/message", response_model=MessageResponse)
async def read_message(
    use_case: GetMessageUseCase = Depends(get_message_use_case),
) -> MessageResponse:  # noqa: D401
    """Эндпоинт получения сообщения."""
    message: Message = await use_case.execute()
    return MessageResponse(content=message.content)

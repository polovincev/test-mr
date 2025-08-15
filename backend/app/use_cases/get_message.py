from fastapi import Depends

from ..entities.message import Message
from ..repositories.message_repository import MessageRepository
from ..repositories.in_memory_message_repository import InMemoryMessageRepository


class GetMessageUseCase:
    """UseCase получения сообщения из репозитория."""

    def __init__(self, repository: MessageRepository):
        self._repository = repository

    async def execute(self) -> Message:
        """Выполняет бизнес-логику получения сообщения."""
        return await self._repository.get_message()


async def get_message_use_case(
    repository: MessageRepository = Depends(InMemoryMessageRepository),
) -> "GetMessageUseCase":  # noqa: D401
    """Провайдер зависимости для FastAPI."""
    return GetMessageUseCase(repository)

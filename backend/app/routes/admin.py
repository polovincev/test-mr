from fastapi import APIRouter

from app.repositories.context_store import clear_all
from app.routes.chat import get_chat_repo

router = APIRouter(prefix="/admin", tags=["admin"])


# noinspection PyAsyncCall
@router.post("/clear")
async def admin_clear():
    """Clear all in-memory context and chats (dangerous)."""
    try:
        repo = await get_chat_repo()  # type: ignore[arg-type]
        clear_fn = getattr(repo, "clear_all", None)
        if callable(clear_fn):
            clear_fn()
    except Exception:
        pass
    clear_all()
    return {"status": "ok"}

from fastapi import Request
import os


MOCK_ENV_VAR = "APP_MOCK"


def is_mock(request: Request | None = None) -> bool:
    """Return True if mock responses should be used.

    Priority (top-to-bottom):
    1. Explicit query param ?mock=true|1|yes
    2. Header X-Mock: 1 / true / yes
    3. Environment variable APP_MOCK=1 (any truthy value)
    """
    # Check query param/header only if request provided (routes can call without).
    if request is not None:
        try:
            qp = request.query_params.get("mock")
            if qp is not None and str(qp).lower() in {"1", "true", "yes"}:
                return True
            hdr = request.headers.get("x-mock")
            if hdr is not None and str(hdr).lower() in {"1", "true", "yes"}:
                return True
        except Exception:
            pass
    # Fallback to env var
    return str(os.getenv(MOCK_ENV_VAR, "0")).lower() in {"1", "true", "yes"}

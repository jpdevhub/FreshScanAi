from fastapi import Request
from slowapi import Limiter


def get_user_id(request: Request) -> str:
    """
    Key rate limits by authenticated Supabase user ID (request.state.user).
    Falls back to client IP for unauthenticated / dev-bypass requests.
    """
    user = getattr(request.state, "user", None)
    if user and isinstance(user, dict):
        uid = user.get("sub") or user.get("id")
        if uid:
            return uid
    return _get_ip(request)


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Global default: 100 requests/hour per user
# Scan endpoints override this with stricter 20/minute limit
limiter = Limiter(key_func=get_user_id, default_limits=["100/hour"])

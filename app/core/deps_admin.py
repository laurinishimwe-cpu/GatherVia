from fastapi import Depends, HTTPException, status
from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User

ADMIN_EMAILS = set(
    email.strip().lower()
    for email in getattr(settings, "admin_emails", "").split(",")
    if email.strip()
)

async def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access only")
    return current_user
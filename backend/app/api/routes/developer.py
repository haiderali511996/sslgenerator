from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import generate_api_key, hash_api_key
from app.db.session import get_db
from app.models.user import User
from app.schemas.api_key import ApiKeyCreated, ApiKeyStatus

router = APIRouter(prefix="/api/developer", tags=["developer"])


@router.get("/api-key", response_model=ApiKeyStatus)
def api_key_status(current_user: User = Depends(get_current_user)):
    return ApiKeyStatus(
        prefix=current_user.api_key_prefix,
        created_at=current_user.api_key_created_at,
        has_key=current_user.api_key_hash is not None,
    )


@router.post("/api-key", response_model=ApiKeyCreated)
def create_or_rotate_api_key(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generates a new API key, invalidating any previous one. The full key
    is only ever returned here — only its hash is stored."""
    api_key = generate_api_key()
    current_user.api_key_hash = hash_api_key(api_key)
    current_user.api_key_prefix = api_key[:12]
    current_user.api_key_created_at = datetime.utcnow()
    db.add(current_user)
    db.commit()

    return ApiKeyCreated(api_key=api_key, prefix=current_user.api_key_prefix, created_at=current_user.api_key_created_at)


@router.delete("/api-key", status_code=204)
def revoke_api_key(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.api_key_hash = None
    current_user.api_key_prefix = None
    current_user.api_key_created_at = None
    db.add(current_user)
    db.commit()

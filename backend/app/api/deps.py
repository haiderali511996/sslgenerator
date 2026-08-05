import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import API_KEY_PREFIX, decode_access_token, hash_api_key
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Accepts either a login JWT or a long-lived API key (prefix 'unc_') as
    the Bearer token, so REST/ACME automation clients can authenticate the
    same way interactive users do."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token.startswith(API_KEY_PREFIX):
        user = db.query(User).filter(User.api_key_hash == hash_api_key(token)).first()
        if user is None or not user.is_active:
            raise credentials_exception
        return user

    subject = decode_access_token(token)
    if subject is None:
        raise credentials_exception

    user = db.get(User, uuid.UUID(subject))
    if user is None or not user.is_active:
        raise credentials_exception
    return user

from datetime import datetime

from pydantic import BaseModel


class ApiKeyCreated(BaseModel):
    api_key: str
    prefix: str
    created_at: datetime


class ApiKeyStatus(BaseModel):
    prefix: str | None
    created_at: datetime | None
    has_key: bool

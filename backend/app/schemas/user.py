import uuid

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    unc_wallet_address: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    is_active: bool
    is_email_verified: bool
    is_unc_member: bool

    class Config:
        from_attributes = True


class EmailVerificationConfirm(BaseModel):
    code: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

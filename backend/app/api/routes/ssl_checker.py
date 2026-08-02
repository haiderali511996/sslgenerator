from fastapi import APIRouter

from app.schemas.certificate import SslCheckRequest, SslCheckResult
from app.services.ssl_checker import check_ssl

router = APIRouter(prefix="/api/ssl-checker", tags=["ssl-checker"])


@router.post("", response_model=SslCheckResult)
def run_ssl_check(payload: SslCheckRequest):
    return check_ssl(payload.host, payload.port)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, certificates, developer, domains, payments, ssl_checker, wallet
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_base_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(domains.router)
app.include_router(certificates.router)
app.include_router(ssl_checker.router)
app.include_router(wallet.router)
app.include_router(payments.router)
app.include_router(developer.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}

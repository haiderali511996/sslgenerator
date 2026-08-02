from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "UNC SSL Generator"
    environment: str = "development"

    database_url: str = "postgresql://unc:unc@localhost:5432/unc_ssl"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    acme_directory_url: str = "https://acme-staging-v02.api.letsencrypt.org/directory"
    acme_contact_email: str = "certificates@uncoin.example"
    challenge_http_root: str = "/var/www/acme-challenges"

    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@uncoin.example"
    smtp_use_tls: bool = True

    frontend_base_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()

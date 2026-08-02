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

    # --- UNC chain config ---
    # DUMMY TESTNET PLACEHOLDERS. UNC's real testnet RPC/chain ID/treasury
    # address were not available yet, so these are stand-ins — override
    # every one of them via .env once real values exist. The integration
    # assumes an EVM-compatible JSON-RPC endpoint (eth_getBalance,
    # eth_getTransactionReceipt, eth_chainId), which is standard for
    # Geth/Besu-based custom chains; adjust unc_chain.py if UNC's node
    # speaks a different RPC dialect.
    unc_rpc_url: str = "https://testnet-rpc.unc-chain.example"
    unc_chain_id: int = 977001
    unc_chain_name: str = "UNC Testnet"
    unc_native_symbol: str = "UNC"
    unc_decimals: int = 18
    unc_block_explorer_url: str = "https://testnet-explorer.unc-chain.example"

    unc_treasury_address: str = "0x1234567890123456789012345678901234567890"
    unc_cert_price: float = 5.0
    unc_min_balance_for_free: float = 1000.0
    unc_min_confirmations: int = 1

    class Config:
        env_file = ".env"


settings = Settings()

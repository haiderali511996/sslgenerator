from pydantic import BaseModel


class WalletNonceOut(BaseModel):
    address_to_sign: None = None
    message: str


class WalletLinkRequest(BaseModel):
    address: str
    signature: str


class WalletStatusOut(BaseModel):
    address: str | None
    balance: float | None
    is_unc_member: bool
    min_balance_for_free: float


class ChainConfigOut(BaseModel):
    rpc_url: str
    chain_id: int
    chain_name: str
    native_symbol: str
    decimals: int
    block_explorer_url: str
    treasury_address: str
    cert_price: float
    min_balance_for_free: float

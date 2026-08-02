import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.wallet import ChainConfigOut, WalletLinkRequest, WalletNonceOut, WalletStatusOut
from app.services import unc_chain

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


@router.get("/config", response_model=ChainConfigOut)
def chain_config():
    return ChainConfigOut(
        rpc_url=settings.unc_rpc_url,
        chain_id=settings.unc_chain_id,
        chain_name=settings.unc_chain_name,
        native_symbol=settings.unc_native_symbol,
        decimals=settings.unc_decimals,
        block_explorer_url=settings.unc_block_explorer_url,
        treasury_address=settings.unc_treasury_address,
        cert_price=settings.unc_cert_price,
        min_balance_for_free=settings.unc_min_balance_for_free,
    )


@router.post("/nonce", response_model=WalletNonceOut)
def request_nonce(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    nonce = secrets.token_hex(16)
    current_user.unc_wallet_nonce = nonce
    db.add(current_user)
    db.commit()

    message = (
        f"Link this wallet to your UNC SSL account ({current_user.email}).\n"
        f"This request will not trigger a blockchain transaction or cost gas.\n\n"
        f"Nonce: {nonce}"
    )
    return WalletNonceOut(message=message)


@router.post("/link", response_model=WalletStatusOut)
def link_wallet(payload: WalletLinkRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.unc_wallet_nonce:
        raise HTTPException(status_code=400, detail="Request a nonce first via POST /api/wallet/nonce")
    if not unc_chain.is_valid_address(payload.address):
        raise HTTPException(status_code=400, detail="Not a valid UNC wallet address")

    message = (
        f"Link this wallet to your UNC SSL account ({current_user.email}).\n"
        f"This request will not trigger a blockchain transaction or cost gas.\n\n"
        f"Nonce: {current_user.unc_wallet_nonce}"
    )

    try:
        recovered = unc_chain.recover_signer(message, payload.signature)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not verify signature: {exc}") from exc

    if recovered.lower() != payload.address.lower():
        raise HTTPException(status_code=400, detail="Signature does not match the provided address")

    current_user.unc_wallet_address = unc_chain.to_checksum(payload.address)
    current_user.unc_wallet_nonce = None

    try:
        balance = unc_chain.get_native_balance(current_user.unc_wallet_address)
        current_user.is_unc_member = balance >= settings.unc_min_balance_for_free
    except unc_chain.ChainUnavailableError:
        balance = None

    db.add(current_user)
    db.commit()

    return WalletStatusOut(
        address=current_user.unc_wallet_address,
        balance=float(balance) if balance is not None else None,
        is_unc_member=current_user.is_unc_member,
        min_balance_for_free=settings.unc_min_balance_for_free,
    )


@router.get("/status", response_model=WalletStatusOut)
def wallet_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.unc_wallet_address:
        return WalletStatusOut(
            address=None, balance=None, is_unc_member=False, min_balance_for_free=settings.unc_min_balance_for_free
        )

    try:
        balance = unc_chain.get_native_balance(current_user.unc_wallet_address)
        current_user.is_unc_member = balance >= settings.unc_min_balance_for_free
        db.add(current_user)
        db.commit()
    except unc_chain.ChainUnavailableError:
        balance = None

    return WalletStatusOut(
        address=current_user.unc_wallet_address,
        balance=float(balance) if balance is not None else None,
        is_unc_member=current_user.is_unc_member,
        min_balance_for_free=settings.unc_min_balance_for_free,
    )


@router.post("/unlink", status_code=204)
def unlink_wallet(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.unc_wallet_address = None
    current_user.unc_wallet_nonce = None
    current_user.is_unc_member = False
    db.add(current_user)
    db.commit()

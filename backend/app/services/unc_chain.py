"""UNC chain integration.

Talks to UNC's node over standard EVM JSON-RPC (eth_getBalance,
eth_getTransactionReceipt, etc.) — the same interface Geth/Besu-based
chains expose, which is the common case for a custom chain built on an
Ethereum-derived stack. UNC is treated as the chain's *native* coin
(like ETH on Ethereum), not an ERC-20 token, since it's the mobile
mining project's own chain rather than a token deployed on someone
else's chain. If UNC turns out to be an ERC-20 on its own chain instead,
swap get_native_balance for a contract `balanceOf` call.

All endpoint/address/price values come from Settings and are dummy
testnet placeholders until UNC's real network details are available.
"""
from decimal import Decimal

from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3
from web3.exceptions import TransactionNotFound

from app.core.config import settings

_w3: Web3 | None = None


def get_web3() -> Web3:
    global _w3
    if _w3 is None:
        _w3 = Web3(Web3.HTTPProvider(settings.unc_rpc_url, request_kwargs={"timeout": 10}))
    return _w3


class ChainUnavailableError(Exception):
    pass


def is_valid_address(address: str) -> bool:
    return Web3.is_address(address)


def to_checksum(address: str) -> str:
    return Web3.to_checksum_address(address)


def get_native_balance(address: str) -> Decimal:
    """Returns the wallet's UNC balance in whole-coin units (not wei)."""
    w3 = get_web3()
    try:
        balance_wei = w3.eth.get_balance(to_checksum(address))
    except Exception as exc:  # noqa: BLE001 - node connectivity, timeouts, etc.
        raise ChainUnavailableError(f"Could not reach UNC chain RPC: {exc}") from exc
    return Decimal(balance_wei) / Decimal(10**settings.unc_decimals)


def recover_signer(message: str, signature: str) -> str:
    encoded = encode_defunct(text=message)
    return Account.recover_message(encoded, signature=signature)


class PaymentVerificationResult:
    def __init__(self, success: bool, reason: str | None = None, amount: Decimal | None = None, confirmations: int = 0):
        self.success = success
        self.reason = reason
        self.amount = amount
        self.confirmations = confirmations


def verify_native_payment(tx_hash: str, expected_from: str, expected_amount: Decimal) -> PaymentVerificationResult:
    """Confirms a UNC native-coin payment to the treasury address.

    Checks: transaction is mined and succeeded, sender matches the
    caller's linked wallet, recipient is the treasury address, and the
    value transferred is at least the expected amount.
    """
    w3 = get_web3()
    try:
        tx = w3.eth.get_transaction(tx_hash)
        receipt = w3.eth.get_transaction_receipt(tx_hash)
    except TransactionNotFound:
        return PaymentVerificationResult(False, "Transaction not found on UNC chain yet")
    except Exception as exc:  # noqa: BLE001
        raise ChainUnavailableError(f"Could not reach UNC chain RPC: {exc}") from exc

    if receipt.status != 1:
        return PaymentVerificationResult(False, "Transaction failed on-chain")

    if tx["from"].lower() != expected_from.lower():
        return PaymentVerificationResult(False, "Transaction sender does not match your linked wallet")

    if tx["to"] is None or tx["to"].lower() != settings.unc_treasury_address.lower():
        return PaymentVerificationResult(False, "Transaction recipient is not the UNC SSL treasury address")

    paid_amount = Decimal(tx["value"]) / Decimal(10**settings.unc_decimals)
    if paid_amount < expected_amount:
        return PaymentVerificationResult(False, f"Amount paid ({paid_amount} UNC) is less than required ({expected_amount} UNC)")

    latest_block = w3.eth.block_number
    confirmations = max(0, latest_block - receipt.blockNumber + 1)
    if confirmations < settings.unc_min_confirmations:
        return PaymentVerificationResult(False, f"Waiting for confirmations ({confirmations}/{settings.unc_min_confirmations})")

    return PaymentVerificationResult(True, amount=paid_amount, confirmations=confirmations)

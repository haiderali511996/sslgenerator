"""ACME (Let's Encrypt) client service.

Implements the ACME v2 issuance flow using the `acme` library (the same
one Certbot is built on): account registration, order creation, HTTP-01 /
DNS-01 challenge fulfillment, finalization, and certificate download.

Important: Let's Encrypt validates domain control by connecting directly
to the customer's domain — never to our backend. So for HTTP-01 the
customer must upload the challenge file to their own web server at
/.well-known/acme-challenge/<token>, and for DNS-01 they must add a TXT
record at _acme-challenge.<domain>. This mirrors the manual file-upload /
DNS-record flow used for our own ownership verification, and is why
issuance is a two-step "start" then "finalize" process below.

Email-verified domains cannot be used for real CA issuance: ACME has no
email-based challenge type. A domain must complete HTTP-01 or DNS-01
before a certificate can be issued, regardless of how it was verified in
our own system.

In-progress ACME orders are kept in an in-process dict keyed by
certificate id. This is sufficient for a single backend instance; a
multi-instance deployment should pin a customer's issuance flow to one
instance (e.g. via sticky sessions) or persist the order URL and
reconstruct the order object from it on each call.
"""
import os
from pathlib import Path

import httpx
import josepy as jose
import OpenSSL
from acme import challenges, client, crypto_util, errors, messages
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import settings
from app.services import dns_checker

ACCOUNT_KEY_PATH = Path(os.environ.get("ACME_ACCOUNT_KEY_PATH", "./data/acme_account_key.pem"))
USER_AGENT = "UNC-SSL-Generator/1.0"

_PENDING_ORDERS: dict[str, dict] = {}


class AcmeIssuanceError(Exception):
    pass


def _load_or_create_account_key() -> jose.JWKRSA:
    ACCOUNT_KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ACCOUNT_KEY_PATH.exists():
        pem_bytes = ACCOUNT_KEY_PATH.read_bytes()
        key = serialization.load_pem_private_key(pem_bytes, password=None)
    else:
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        pem_bytes = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        ACCOUNT_KEY_PATH.write_bytes(pem_bytes)

    return jose.JWKRSA(key=jose.ComparableRSAKey(key))


def _get_acme_client() -> client.ClientV2:
    account_key = _load_or_create_account_key()
    net = client.ClientNetwork(account_key, user_agent=USER_AGENT)
    directory = client.ClientV2.get_directory(settings.acme_directory_url, net)
    acme_client = client.ClientV2(directory, net=net)

    try:
        acme_client.new_account(
            messages.NewRegistration.from_data(
                email=settings.acme_contact_email, terms_of_service_agreed=True
            )
        )
    except errors.ConflictError:
        pass

    return acme_client


def _generate_key_and_csr(domain_name: str) -> tuple[bytes, bytes]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pkey = OpenSSL.crypto.load_privatekey(OpenSSL.crypto.FILETYPE_PEM, private_key_pem)
    csr_pem = crypto_util.make_csr(
        OpenSSL.crypto.dump_privatekey(OpenSSL.crypto.FILETYPE_PEM, pkey), [domain_name]
    )
    return private_key_pem, csr_pem


def start_order(certificate_id: str, domain_name: str, validation_method: str) -> dict:
    """Creates the ACME order and returns instructions for the customer.

    For 'http': {'type': 'http', 'url_path': '/.well-known/acme-challenge/<token>', 'content': '<key_authorization>'}
    For 'dns': {'type': 'dns', 'record_name': '_acme-challenge.<domain>', 'record_value': '<validation>'}
    """
    if validation_method not in ("http", "dns"):
        raise AcmeIssuanceError(
            "Let's Encrypt requires HTTP-01 or DNS-01 validation; "
            "email verification alone cannot be used to issue a certificate."
        )

    try:
        acme_client = _get_acme_client()
        private_key_pem, csr_pem = _generate_key_and_csr(domain_name)
        order = acme_client.new_order(csr_pem)

        authz = order.authorizations[0]
        chall_type = challenges.HTTP01 if validation_method == "http" else challenges.DNS01
        achall = next(c for c in authz.body.challenges if isinstance(c.chall, chall_type))
        response, validation = achall.response_and_validation(acme_client.net.key)
    except errors.Error as exc:
        raise AcmeIssuanceError(f"Could not start ACME order: {exc}") from exc

    _PENDING_ORDERS[certificate_id] = {
        "acme_client": acme_client,
        "order": order,
        "achall": achall,
        "response": response,
        "domain_name": domain_name,
        "private_key_pem": private_key_pem,
        "validation_method": validation_method,
    }

    if validation_method == "http":
        return {
            "type": "http",
            "url_path": f"/.well-known/acme-challenge/{achall.chall.encode('token')}",
            "content": validation,
        }
    return {
        "type": "dns",
        "record_name": f"_acme-challenge.{domain_name}",
        "record_value": validation,
    }


def finalize_order(certificate_id: str) -> dict:
    """Verifies the customer has published the challenge, then completes issuance."""
    pending = _PENDING_ORDERS.get(certificate_id)
    if not pending:
        raise AcmeIssuanceError("No pending ACME order for this certificate; call start_order first")

    domain_name = pending["domain_name"]
    validation_method = pending["validation_method"]

    key_authorization = pending["response"].key_authorization

    if validation_method == "http":
        token = pending["achall"].chall.encode("token")
        url = f"http://{domain_name}/.well-known/acme-challenge/{token}"
        try:
            resp = httpx.get(url, timeout=10, follow_redirects=True)
        except httpx.HTTPError as exc:
            raise AcmeIssuanceError(f"Could not reach {url}: {exc}") from exc
        if resp.status_code != 200 or resp.text.strip() != key_authorization:
            raise AcmeIssuanceError(
                f"Challenge file at {url} not found or content does not match yet. "
                f"Make sure it returns exactly: {key_authorization}"
            )
    else:
        if key_authorization not in dns_checker.get_txt_records(domain_name, subdomain_prefix="_acme-challenge"):
            raise AcmeIssuanceError(
                f"TXT record at _acme-challenge.{domain_name} not found or does not match yet. "
                f"Expected value: {key_authorization}"
            )

    try:
        acme_client: client.ClientV2 = pending["acme_client"]
        acme_client.answer_challenge(pending["achall"], pending["response"])
        finalized_order = acme_client.poll_and_finalize(pending["order"])
    except errors.ValidationError as exc:
        raise AcmeIssuanceError(f"ACME domain validation failed: {exc}") from exc
    finally:
        _PENDING_ORDERS.pop(certificate_id, None)

    fullchain_pem = finalized_order.fullchain_pem
    leaf_pem, _, chain_pem = fullchain_pem.partition("\n-----END CERTIFICATE-----\n")
    leaf_pem = leaf_pem + "\n-----END CERTIFICATE-----\n"

    cert = OpenSSL.crypto.load_certificate(OpenSSL.crypto.FILETYPE_PEM, leaf_pem)

    return {
        "private_key_pem": pending["private_key_pem"].decode(),
        "certificate_pem": leaf_pem,
        "chain_pem": chain_pem.strip() or None,
        "not_before": cert.get_notBefore().decode(),
        "not_after": cert.get_notAfter().decode(),
    }

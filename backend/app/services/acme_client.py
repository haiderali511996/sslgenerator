"""ACME (Let's Encrypt) client service.

Implements the ACME v2 issuance flow using the `acme` library (the same
one Certbot is built on): account registration, order creation, HTTP-01 /
DNS-01 challenge fulfillment, finalization, and certificate download.

Important: Let's Encrypt validates domain control by connecting directly
to the customer's domain(s) — never to our backend. So for HTTP-01 the
customer must upload the challenge file to each domain's own web server
at /.well-known/acme-challenge/<token>, and for DNS-01 they must add a
TXT record at _acme-challenge.<domain> for each name. This mirrors the
manual file-upload / DNS-record flow used for our own ownership
verification, and is why issuance is a two-step "start" then "finalize"
process below.

Email-verified domains cannot be used for real CA issuance: ACME has no
email-based challenge type. Every domain in the certificate must have
completed HTTP-01 or DNS-01, regardless of how it was verified in our
own system.

Certificates can cover multiple domain names (SAN) in one order, and a
wildcard entry (*.domain.com) can be included alongside its bare domain
— the ACME spec forbids HTTP-01 for wildcard names, so any order that
includes one requires DNS-01 for the whole order. A wildcard and its
bare domain share one DNS record name (_acme-challenge.<domain>) but
need two different TXT values there; unrelated SAN domains each get
their own distinct record name. finalize_order() checks each
authorization against its own derived name/URL accordingly.

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

ALLOWED_KEY_SIZES = (2048, 3072, 4096)

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
    except errors.ConflictError as exc:
        # The account key is persisted at ACCOUNT_KEY_PATH and reused across
        # calls, so after the first successful run every later new_account
        # hits this path (Let's Encrypt returns 409 for an already-known
        # key). The account URL Boulder returns in the Location header
        # never reaches ClientNetwork otherwise, so every signed request
        # after this one — including new_order — gets sent with a JWK
        # header instead of the required Key ID, and Let's Encrypt rejects
        # it as malformed ("No Key ID in JWS header"). Registering the
        # existing account URL here is what makes ClientV2 sign with kid.
        acme_client.net.account = messages.RegistrationResource(uri=exc.location, body=messages.Registration())

    return acme_client


def _generate_key_and_csr(domain_names: list[str], key_size: int) -> tuple[bytes, bytes]:
    if key_size not in ALLOWED_KEY_SIZES:
        raise AcmeIssuanceError(f"Unsupported RSA key size {key_size}; choose one of {ALLOWED_KEY_SIZES}")

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=key_size)
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pkey = OpenSSL.crypto.load_privatekey(OpenSSL.crypto.FILETYPE_PEM, private_key_pem)
    csr_pem = crypto_util.make_csr(
        OpenSSL.crypto.dump_privatekey(OpenSSL.crypto.FILETYPE_PEM, pkey), domain_names
    )
    return private_key_pem, csr_pem


def _dns_record_name(identifier_value: str) -> str:
    """_acme-challenge host for a domain, stripping a leading wildcard label."""
    base = identifier_value[2:] if identifier_value.startswith("*.") else identifier_value
    return f"_acme-challenge.{base}"


def start_order(certificate_id: str, domain_names: list[str], validation_method: str, key_size: int = 2048) -> dict:
    """Creates the ACME order and returns instructions for the customer.

    domain_names may include a wildcard entry (e.g. '*.example.com') and/or
    multiple unrelated domains — every name in the list is validated the
    same way (validation_method).

    For 'http': {'type': 'http', 'items': [{'domain', 'url_path', 'content'}, ...]}
    For 'dns': {'type': 'dns', 'items': [{'domain', 'record_name', 'record_value'}, ...]}
    """
    has_wildcard = any(name.startswith("*.") for name in domain_names)
    if has_wildcard and validation_method != "dns":
        raise AcmeIssuanceError("Wildcard certificates can only be validated via DNS-01.")
    if validation_method not in ("http", "dns"):
        raise AcmeIssuanceError(
            "Let's Encrypt requires HTTP-01 or DNS-01 validation; "
            "email verification alone cannot be used to issue a certificate."
        )

    chall_type = challenges.HTTP01 if validation_method == "http" else challenges.DNS01

    try:
        acme_client = _get_acme_client()
        private_key_pem, csr_pem = _generate_key_and_csr(domain_names, key_size)
        order = acme_client.new_order(csr_pem)

        pending_challenges = []
        for authz in order.authorizations:
            identifier_value = authz.body.identifier.value
            achall = next(c for c in authz.body.challenges if isinstance(c.chall, chall_type))
            response, validation = achall.response_and_validation(acme_client.net.key)
            pending_challenges.append(
                {"identifier": identifier_value, "achall": achall, "response": response, "validation": validation}
            )
    except errors.Error as exc:
        raise AcmeIssuanceError(f"Could not start ACME order: {exc}") from exc

    _PENDING_ORDERS[certificate_id] = {
        "acme_client": acme_client,
        "order": order,
        "challenges": pending_challenges,
        "private_key_pem": private_key_pem,
        "validation_method": validation_method,
    }

    if validation_method == "http":
        return {
            "type": "http",
            "items": [
                {
                    "domain": c["identifier"],
                    "url_path": f"/.well-known/acme-challenge/{c['achall'].chall.encode('token')}",
                    "content": c["validation"],
                }
                for c in pending_challenges
            ],
        }
    return {
        "type": "dns",
        "items": [
            {"domain": c["identifier"], "record_name": _dns_record_name(c["identifier"]), "record_value": c["validation"]}
            for c in pending_challenges
        ],
    }


def finalize_order(certificate_id: str) -> dict:
    """Verifies the customer has published the challenge(s), then completes issuance."""
    pending = _PENDING_ORDERS.get(certificate_id)
    if not pending:
        raise AcmeIssuanceError("No pending ACME order for this certificate; call start_order first")

    validation_method = pending["validation_method"]
    pending_challenges = pending["challenges"]

    for challenge in pending_challenges:
        identifier = challenge["identifier"]
        key_authorization = challenge["response"].key_authorization

        if validation_method == "http":
            token = challenge["achall"].chall.encode("token")
            url = f"http://{identifier}/.well-known/acme-challenge/{token}"
            try:
                resp = httpx.get(url, timeout=10, follow_redirects=True)
            except httpx.HTTPError as exc:
                raise AcmeIssuanceError(f"Could not reach {url}: {exc}") from exc
            if resp.status_code != 200 or resp.text.strip() != key_authorization:
                raise AcmeIssuanceError(
                    f"Challenge file at {url} not found or does not match yet. Make sure it returns exactly: "
                    f"{key_authorization} — then wait a moment and try finalizing again; changes to a live web "
                    f"server can take a few seconds to take effect."
                )
        else:
            # DNS-01 requires base64url(SHA256(key_authorization)) in the TXT
            # record — a different, dot-free value from the raw
            # key_authorization used above for HTTP-01. That's what
            # start_order() already computed as `validation` and told the
            # customer to publish; checking against the raw key_authorization
            # here (as before) could never match, since that string never
            # appears in DNS at all.
            expected_value = challenge["validation"]
            base_domain = identifier[2:] if identifier.startswith("*.") else identifier
            published = dns_checker.get_txt_records(base_domain, subdomain_prefix="_acme-challenge")
            if expected_value not in published:
                raise AcmeIssuanceError(
                    f"TXT record at _acme-challenge.{base_domain} not found or does not match yet for {identifier}. "
                    f"Expected value: {expected_value} — DNS changes can take a few minutes (sometimes longer, "
                    f"depending on your provider) to propagate. Wait a bit and try finalizing again."
                )

    try:
        acme_client: client.ClientV2 = pending["acme_client"]
        for challenge in pending_challenges:
            acme_client.answer_challenge(challenge["achall"], challenge["response"])
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

import socket
import ssl
from datetime import datetime, timezone

from app.schemas.certificate import SslCheckResult

_CERT_TIME_FORMAT = "%b %d %H:%M:%S %Y %Z"


def check_ssl(host: str, port: int = 443) -> SslCheckResult:
    context = ssl.create_default_context()

    try:
        with socket.create_connection((host, port), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=host) as tls_sock:
                cert = tls_sock.getpeercert()
                protocol_version = tls_sock.version()
    except ssl.SSLCertVerificationError as exc:
        return SslCheckResult(
            host=host, port=port, is_valid=False, issuer=None, subject=None,
            not_before=None, not_after=None, days_until_expiry=None,
            protocol_version=None, error=f"Certificate verification failed: {exc}",
        )
    except (socket.timeout, socket.gaierror, ConnectionRefusedError, OSError) as exc:
        return SslCheckResult(
            host=host, port=port, is_valid=False, issuer=None, subject=None,
            not_before=None, not_after=None, days_until_expiry=None,
            protocol_version=None, error=f"Connection failed: {exc}",
        )

    subject = ", ".join("=".join(pair) for rdn in cert.get("subject", []) for pair in rdn)
    issuer = ", ".join("=".join(pair) for rdn in cert.get("issuer", []) for pair in rdn)
    san = [value for key, value in cert.get("subjectAltName", []) if key == "DNS"]

    not_before = datetime.strptime(cert["notBefore"], _CERT_TIME_FORMAT).replace(tzinfo=timezone.utc)
    not_after = datetime.strptime(cert["notAfter"], _CERT_TIME_FORMAT).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    days_until_expiry = (not_after - now).days

    warnings: list[str] = []
    if days_until_expiry < 0:
        warnings.append("Certificate has expired")
    elif days_until_expiry < 14:
        warnings.append(f"Certificate expires soon ({days_until_expiry} days)")
    if host not in san and not any(_matches_wildcard(pattern, host) for pattern in san):
        warnings.append("Hostname does not match certificate SAN entries")
    if protocol_version in ("TLSv1", "TLSv1.1", "SSLv3", "SSLv2"):
        warnings.append(f"Outdated protocol in use: {protocol_version}")

    return SslCheckResult(
        host=host,
        port=port,
        is_valid=days_until_expiry >= 0,
        issuer=issuer,
        subject=subject,
        not_before=not_before,
        not_after=not_after,
        days_until_expiry=days_until_expiry,
        protocol_version=protocol_version,
        san=san,
        warnings=warnings,
    )


def _matches_wildcard(pattern: str, host: str) -> bool:
    if not pattern.startswith("*."):
        return False
    return host.endswith(pattern[1:])

import dns.resolver

# Public resolvers instead of whatever the host/container's default resolver
# is (e.g. a cloud provider's internal VPC DNS). Those can lag or cache
# inconsistently with what a customer's own DNS checker shows them, which
# makes "I published the record but verification still fails" look like an
# app bug when it's really just a stale answer from one specific resolver.
# Cloudflare and Google both respect record TTLs properly and are what most
# public DNS checker tools query against, so using them keeps our answers
# consistent with what the customer is looking at.
_PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8"]


def _get_resolver() -> dns.resolver.Resolver:
    resolver = dns.resolver.Resolver(configure=False)
    resolver.nameservers = _PUBLIC_RESOLVERS
    return resolver


def get_txt_records(domain: str, subdomain_prefix: str = "_unc-ssl-challenge") -> list[str]:
    fqdn = f"{subdomain_prefix}.{domain}"
    values: list[str] = []
    try:
        answers = _get_resolver().resolve(fqdn, "TXT", lifetime=10)
        for rdata in answers:
            for txt_string in rdata.strings:
                values.append(txt_string.decode() if isinstance(txt_string, bytes) else str(txt_string))
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
        return []
    return values


def verify_txt_record(domain: str, expected_value: str) -> bool:
    return expected_value in get_txt_records(domain)

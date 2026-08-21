import dns.resolver

# Public resolvers as the fallback path — better than whatever the host's
# default resolver is (e.g. a cloud provider's internal VPC DNS), but even
# these can disagree depending on which anycast node answers a given query:
# confirmed in production, where the app's resolver and an external check
# returned different answers for the same record at the same moment, both
# nominally querying 1.1.1.1/8.8.8.8. The primary path below queries the
# domain's own authoritative nameservers directly instead, which is always
# the source of truth and has no propagation delay of its own — recursive
# resolvers are what's slow to catch up, not the authoritative servers.
_PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8"]
_MAX_ZONE_WALK = 5


def _get_resolver(nameservers: list[str] | None = None) -> dns.resolver.Resolver:
    resolver = dns.resolver.Resolver(configure=False)
    resolver.nameservers = nameservers or _PUBLIC_RESOLVERS
    return resolver


def _authoritative_ips_for(domain: str) -> list[str]:
    """Walks up from `domain` to find its zone's NS records, then resolves
    those nameserver hostnames to IPs. Returns [] if none could be found
    (caller should fall back to a recursive resolver)."""
    resolver = _get_resolver()
    labels = domain.split(".")

    for i in range(min(_MAX_ZONE_WALK, len(labels) - 1)):
        candidate = ".".join(labels[i:])
        try:
            ns_answers = resolver.resolve(candidate, "NS", lifetime=10)
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
            continue

        ips: list[str] = []
        for rdata in ns_answers:
            ns_host = str(rdata.target).rstrip(".")
            try:
                for a in resolver.resolve(ns_host, "A", lifetime=10):
                    ips.append(str(a))
            except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
                continue
        if ips:
            return ips

    return []


def get_txt_records(domain: str, subdomain_prefix: str = "_unc-ssl-challenge") -> list[str]:
    fqdn = f"{subdomain_prefix}.{domain}"

    authoritative_ips = _authoritative_ips_for(domain)
    resolvers_to_try = [authoritative_ips] if authoritative_ips else []
    resolvers_to_try.append(_PUBLIC_RESOLVERS)

    for nameservers in resolvers_to_try:
        try:
            answers = _get_resolver(nameservers).resolve(fqdn, "TXT", lifetime=10)
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
            continue

        values: list[str] = []
        for rdata in answers:
            for txt_string in rdata.strings:
                values.append(txt_string.decode() if isinstance(txt_string, bytes) else str(txt_string))
        if values:
            return values

    return []


def verify_txt_record(domain: str, expected_value: str) -> bool:
    return expected_value in get_txt_records(domain)

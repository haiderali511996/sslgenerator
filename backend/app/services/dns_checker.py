import dns.resolver


def get_txt_records(domain: str, subdomain_prefix: str = "_unc-ssl-challenge") -> list[str]:
    fqdn = f"{subdomain_prefix}.{domain}"
    values: list[str] = []
    try:
        answers = dns.resolver.resolve(fqdn, "TXT", lifetime=10)
        for rdata in answers:
            for txt_string in rdata.strings:
                values.append(txt_string.decode() if isinstance(txt_string, bytes) else str(txt_string))
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
        return []
    return values


def verify_txt_record(domain: str, expected_value: str) -> bool:
    return expected_value in get_txt_records(domain)

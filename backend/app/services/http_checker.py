import httpx

CHALLENGE_PATH_PREFIX = "/.well-known/unc-ssl-challenge"


def challenge_url(domain: str, token: str) -> str:
    return f"http://{domain}{CHALLENGE_PATH_PREFIX}/{token}"


def verify_http_challenge(domain: str, token: str, expected_value: str) -> bool:
    url = challenge_url(domain, token)
    try:
        response = httpx.get(url, timeout=10, follow_redirects=True)
    except httpx.HTTPError:
        return False
    if response.status_code != 200:
        return False
    return response.text.strip() == expected_value

export type StatusKind = "success" | "pending" | "warning" | "error";

export interface DescribedStatus {
  kind: StatusKind;
  summary: string;
  detail?: string;
}

const ACME_ERROR_SUMMARIES: Record<string, string> = {
  malformed: "There was a problem starting the request with Let's Encrypt. Please try again.",
  rejectedIdentifier: "Let's Encrypt won't issue a certificate for this domain — it's blocked by their policy.",
  rateLimited: "Let's Encrypt's rate limit was hit. Please wait a while before trying again.",
  dns: "We couldn't resolve DNS for this domain. Double-check your DNS configuration.",
  unauthorized: "Domain ownership couldn't be confirmed by Let's Encrypt.",
  connection: "Let's Encrypt couldn't connect to your domain to verify it.",
  incorrectResponse: "The verification response didn't match what Let's Encrypt expected.",
  serverInternal: "Let's Encrypt is having issues right now. Please try again shortly.",
  alreadyRevoked: "This certificate has already been revoked.",
  accountDoesNotExist: "There's a problem with our certificate authority account — please contact support.",
  badNonce: "A temporary network hiccup occurred. Please try again.",
  caa: "This domain's CAA DNS record doesn't allow Let's Encrypt to issue certificates for it.",
};

function extractAcmeErrorType(raw: string): string | null {
  const match = raw.match(/acme:error:(\w+)/);
  return match ? match[1] : null;
}

/** Turns a raw backend/ACME error string into a clean summary + collapsible technical detail. */
export function describeError(raw: string | null | undefined): DescribedStatus {
  if (!raw) return { kind: "error", summary: "Something went wrong. Please try again." };

  if (raw.includes("TXT record at") || raw.includes("Challenge file at")) {
    return {
      kind: "pending",
      summary: "Not verified yet — DNS and file changes can take a few minutes (sometimes longer) to propagate.",
      detail: raw,
    };
  }

  const acmeType = extractAcmeErrorType(raw);
  if (acmeType) {
    return {
      kind: "error",
      summary: ACME_ERROR_SUMMARIES[acmeType] || "Let's Encrypt rejected this request.",
      detail: raw,
    };
  }

  // Our own hand-written backend messages (validation errors, payment checks,
  // etc.) are already written for humans — show them directly, no detail needed.
  return { kind: "error", summary: raw };
}

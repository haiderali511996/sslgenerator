import { Certificate } from "./api";

export type CertBucket = "draft" | "pending_validation" | "expiring_soon" | "issued" | "expired" | "failed";

const EXPIRING_SOON_DAYS = 14;

export function bucketFor(cert: Certificate): CertBucket {
  if (cert.status === "failed") return "failed";
  if (cert.status === "pending" || cert.status === "awaiting_challenge") return "draft";
  if (cert.status === "issuing") return "pending_validation";

  if (cert.status === "issued" && cert.not_after) {
    const daysLeft = (new Date(cert.not_after).getTime() - Date.now()) / 86400000;
    if (daysLeft < 0) return "expired";
    if (daysLeft <= EXPIRING_SOON_DAYS) return "expiring_soon";
    return "issued";
  }

  return "draft";
}

export const BUCKET_LABELS: Record<CertBucket, string> = {
  draft: "Draft",
  pending_validation: "Pending Validation",
  expiring_soon: "Expiring Soon",
  issued: "Issued",
  expired: "Expired",
  failed: "Failed",
};

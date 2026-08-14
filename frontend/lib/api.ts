const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("unc_ssl_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("unc_ssl_token", token);
  else localStorage.removeItem("unc_ssl_token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  is_unc_member: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Domain {
  id: string;
  name: string;
  is_verified: boolean;
  verification_method: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface VerificationChallenge {
  id: string;
  method: string;
  token: string;
  expected_value: string;
  status: string;
  target_email: string | null;
}

export interface ChallengeItem {
  domain: string;
  url_path: string | null;
  content: string | null;
  record_name: string | null;
  record_value: string | null;
}

export interface Certificate {
  id: string;
  domain_id: string;
  status: string;
  ca: string;
  validation_method: string;
  is_wildcard: boolean;
  key_size: number;
  additional_domains: string[];
  challenge_items: ChallengeItem[];
  not_before: string | null;
  not_after: string | null;
  error_message: string | null;
  created_at: string;
  issued_at: string | null;
}

export interface SslCheckResult {
  host: string;
  port: number;
  is_valid: boolean;
  issuer: string | null;
  subject: string | null;
  not_before: string | null;
  not_after: string | null;
  days_until_expiry: number | null;
  protocol_version: string | null;
  san: string[];
  warnings: string[];
  error: string | null;
}

export interface ChainConfig {
  rpc_url: string;
  chain_id: number;
  chain_name: string;
  native_symbol: string;
  decimals: number;
  block_explorer_url: string;
  treasury_address: string;
  cert_price: number;
  min_balance_for_free: number;
}

export interface WalletStatus {
  address: string | null;
  balance: number | null;
  is_unc_member: boolean;
  min_balance_for_free: number;
}

export interface Payment {
  id: string;
  domain_id: string;
  certificate_id: string | null;
  tx_hash: string;
  amount: number;
  status: string;
  error_message: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export const api = {
  signup: (data: { email: string; password: string; full_name?: string; unc_wallet_address?: string }) =>
    apiFetch<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => apiFetch<User>("/api/auth/me"),
  requestEmailVerification: () => apiFetch<void>("/api/auth/verify-email/request", { method: "POST" }),
  confirmEmailVerification: (code: string) =>
    apiFetch<User>("/api/auth/verify-email/confirm", { method: "POST", body: JSON.stringify({ code }) }),

  listDomains: () => apiFetch<Domain[]>("/api/domains"),
  createDomain: (name: string) => apiFetch<Domain>("/api/domains", { method: "POST", body: JSON.stringify({ name }) }),
  startVerification: (domainId: string, method: string, target_email?: string) =>
    apiFetch<VerificationChallenge>(`/api/domains/${domainId}/verify/start`, {
      method: "POST",
      body: JSON.stringify({ method, target_email }),
    }),
  checkVerification: (domainId: string, challengeId: string, code?: string) =>
    apiFetch<VerificationChallenge>(`/api/domains/${domainId}/verify/${challengeId}/check`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  listCertificates: (q?: string) => apiFetch<Certificate[]>(`/api/certificates${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  requestCertificate: (params: { domain_id: string; wildcard?: boolean; additional_domain_ids?: string[]; key_size?: number }) =>
    apiFetch<Certificate>("/api/certificates", { method: "POST", body: JSON.stringify(params) }),
  finalizeCertificate: (certificateId: string) =>
    apiFetch<Certificate>(`/api/certificates/${certificateId}/finalize`, { method: "POST" }),
  cancelCertificate: (certificateId: string) =>
    apiFetch<Certificate>(`/api/certificates/${certificateId}/cancel`, { method: "POST" }),
  downloadCertificate: (certificateId: string) =>
    apiFetch<{ certificate_pem: string; chain_pem: string | null; private_key_pem: string }>(
      `/api/certificates/${certificateId}/download`
    ),

  checkSsl: (host: string, port = 443) =>
    apiFetch<SslCheckResult>("/api/ssl-checker", { method: "POST", body: JSON.stringify({ host, port }) }),

  walletConfig: () => apiFetch<ChainConfig>("/api/wallet/config"),
  walletStatus: () => apiFetch<WalletStatus>("/api/wallet/status"),
  walletNonce: () => apiFetch<{ message: string }>("/api/wallet/nonce", { method: "POST" }),
  walletLink: (address: string, signature: string) =>
    apiFetch<WalletStatus>("/api/wallet/link", { method: "POST", body: JSON.stringify({ address, signature }) }),
  walletUnlink: () => apiFetch<void>("/api/wallet/unlink", { method: "POST" }),

  listPayments: () => apiFetch<Payment[]>("/api/payments"),
  submitUncPayment: (domain_id: string, tx_hash: string) =>
    apiFetch<Payment>("/api/payments/unc/submit", { method: "POST", body: JSON.stringify({ domain_id, tx_hash }) }),

  apiKeyStatus: () => apiFetch<ApiKeyStatus>("/api/developer/api-key"),
  createApiKey: () => apiFetch<ApiKeyCreated>("/api/developer/api-key", { method: "POST" }),
  revokeApiKey: () => apiFetch<void>("/api/developer/api-key", { method: "DELETE" }),
};

export interface ApiKeyStatus {
  prefix: string | null;
  created_at: string | null;
  has_key: boolean;
}

export interface ApiKeyCreated {
  api_key: string;
  prefix: string;
  created_at: string;
}

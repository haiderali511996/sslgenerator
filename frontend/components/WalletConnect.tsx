"use client";

import { useEffect, useState } from "react";
import { api, ChainConfig, WalletStatus } from "@/lib/api";
import { connectWallet, ensureUncChain, hasBrowserWallet, signMessage } from "@/lib/wallet";

export default function WalletConnect() {
  const [config, setConfig] = useState<ChainConfig | null>(null);
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.walletConfig().then(setConfig).catch(() => {});
    refreshStatus();
  }, []);

  function refreshStatus() {
    api.walletStatus().then(setStatus).catch(() => {});
  }

  async function handleConnect() {
    setError(null);
    setBusy(true);
    try {
      if (!hasBrowserWallet()) throw new Error("No wallet extension found. Install MetaMask or a compatible wallet.");
      const address = await connectWallet();
      if (config) await ensureUncChain(config);
      const { message } = await api.walletNonce();
      const signature = await signMessage(address, message);
      const result = await api.walletLink(address, signature);
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect wallet");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    try {
      await api.walletUnlink();
      refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <div className="border border-slate-800 rounded-lg p-4">
      {status.address ? (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm text-slate-400">UNC wallet linked</p>
            <p className="font-mono text-sm">{status.address}</p>
            <p className="text-sm mt-1">
              Balance: <span className="font-medium">{status.balance ?? "-"}</span> UNC
              {status.is_unc_member && <span className="ml-2 text-unc-500">Member — free certificates</span>}
            </p>
          </div>
          <button onClick={handleUnlink} disabled={busy} className="text-sm text-slate-400 hover:text-white">
            Unlink
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-slate-400">
            Link your UNC wallet to unlock free certificates at {status.min_balance_for_free}+ UNC balance.
          </p>
          <button onClick={handleConnect} disabled={busy} className="bg-unc-600 hover:bg-unc-500 disabled:opacity-50 px-4 py-2 rounded-md text-sm text-white">
            {busy ? "Connecting..." : "Connect wallet"}
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

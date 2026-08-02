import { ChainConfig } from "./api";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function hasBrowserWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("No wallet extension found. Install MetaMask or a compatible wallet.");
  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) throw new Error("No account was authorized");
  return accounts[0];
}

export async function ensureUncChain(config: ChainConfig): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet extension found");
  const chainIdHex = `0x${config.chain_id.toString(16)}`;

  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: config.chain_name,
            nativeCurrency: { name: config.native_symbol, symbol: config.native_symbol, decimals: config.decimals },
            rpcUrls: [config.rpc_url],
            blockExplorerUrls: config.block_explorer_url ? [config.block_explorer_url] : [],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function signMessage(address: string, message: string): Promise<string> {
  if (!window.ethereum) throw new Error("No wallet extension found");
  return (await window.ethereum.request({ method: "personal_sign", params: [message, address] })) as string;
}

export async function sendUncPayment(fromAddress: string, toAddress: string, amountUnc: number, decimals: number): Promise<string> {
  if (!window.ethereum) throw new Error("No wallet extension found");
  const amountWei = BigInt(Math.round(amountUnc * 10 ** 6)) * BigInt(10 ** (decimals - 6));
  const valueHex = `0x${amountWei.toString(16)}`;

  return (await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from: fromAddress, to: toAddress, value: valueHex }],
  })) as string;
}

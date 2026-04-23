export type PinStatusValue = 'queued' | 'pinning' | 'pinned' | 'failed';

export interface Pin {
  cid: string;
  name?: string;
  origins?: string[];
  meta?: Record<string, string>;
}

export interface StoredPinRecord {
  requestid: string;
  cid: string;
  name: string | null;
  status: PinStatusValue;
  origins: string[];
  meta: Record<string, string>;
  delegates: string[];
  info: Record<string, unknown>;
  owner: string;
  created: string;
  updated: string;
  expires_at: string | null;
}

export interface PinStatusResponse {
  requestid: string;
  status: PinStatusValue;
  created: string;
  pin: Pin;
  delegates: string[];
  info: Record<string, unknown>;
}

export interface PinResultsResponse {
  count: number;
  results: PinStatusResponse[];
}

export interface AgentCardX402Chain {
  network: string;
  usdcAssetAddress: string;
}

export interface AgentCardConfig {
  name: string;
  description: string;
  version: string;
  x402Chains: AgentCardX402Chain[];
  x402RatePerGbMonthUsd: number;
  x402MinPriceUsd: number;
  x402MaxPriceUsd: number;
  x402DefaultDurationMonths: number;
  x402MaxDurationMonths: number;
  mppMethod?: string;
  mppChainId?: number;
  mppAsset?: string;
  mppAssetSymbol?: string;
}

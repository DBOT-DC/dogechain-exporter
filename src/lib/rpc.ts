import {
  RPC_ENDPOINTS,
  API_TIMEOUT_MS,
  API_RATE_LIMIT_MS,
} from './config';

let lastCallTime = 0;
let currentEndpointIndex = 0;

/**
 * Rate-limited RPC call with automatic failover between endpoints.
 */
export async function rpcCall(
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < API_RATE_LIMIT_MS) {
    await sleep(API_RATE_LIMIT_MS - timeSinceLastCall);
  }

  // Try each endpoint in order
  for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt++) {
    const endpoint =
      RPC_ENDPOINTS[(currentEndpointIndex + attempt) % RPC_ENDPOINTS.length];
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(
          `RPC error ${data.error.code}: ${data.error.message}`
        );
      }

      lastCallTime = Date.now();
      currentEndpointIndex = (currentEndpointIndex + attempt) % RPC_ENDPOINTS.length;
      return data.result;
    } catch (err) {
      const isLast = attempt === RPC_ENDPOINTS.length - 1;
      if (isLast) {
        throw new Error(
          `All RPC endpoints failed for ${method}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      // Try next endpoint
    }
  }

  throw new Error('No RPC endpoints available');
}

/**
 * Get the current block number.
 */
export async function getLatestBlockNumber(): Promise<number> {
  const result = await rpcCall('eth_blockNumber');
  return parseInt(String(result), 16);
}

/**
 * Get block details by number (with full transaction objects).
 */
export async function getBlockByNumber(
  blockNumber: number,
  fullTxs: boolean = false,
): Promise<Record<string, unknown> | null> {
  const hex = '0x' + blockNumber.toString(16);
  const result = await rpcCall('eth_getBlockByNumber', [hex, fullTxs]);
  return (result as Record<string, unknown>) || null;
}

/**
 * Get transaction receipt.
 */
export async function getTransactionReceipt(
  txHash: string,
): Promise<Record<string, unknown> | null> {
  const result = await rpcCall('eth_getTransactionReceipt', [txHash]);
  return (result as Record<string, unknown>) || null;
}

/**
 * Get transaction by hash.
 */
export async function getTransactionByHash(
  txHash: string,
): Promise<Record<string, unknown> | null> {
  const result = await rpcCall('eth_getTransactionByHash', [txHash]);
  return (result as Record<string, unknown>) || null;
}

/**
 * Get logs with filter.
 */
export async function getLogs(
  filter: {
    fromBlock?: string;
    toBlock?: string;
    address?: string | string[];
    topics?: (string | null)[];
    blockHash?: string;
  },
): Promise<Record<string, unknown>[]> {
  const result = await rpcCall('eth_getLogs', [filter]);
  return (result as Record<string, unknown>[]) || [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

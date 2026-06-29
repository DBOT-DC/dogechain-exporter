// Dogechain RPC configuration
export const DOGECHAIN_CHAIN_ID = 2000;
export const DOGECHAIN_NATIVE_SYMBOL = 'DOGE';
export const DOGECHAIN_NATIVE_DECIMALS = 18;

// RPC endpoints (failover order)
// NOTE: thirdweb has ~1000 block limit per eth_getLogs
//       rpc.dogechain.dog has ~5000 block limit per eth_getLogs
//       ankr requires API key — removed
export const RPC_ENDPOINTS = [
  'https://rpc.dogechain.dog',
  'https://dogechain.rpc.thirdweb.com',
] as const;

// ERC20 Transfer event signature
export const TRANSFER_EVENT_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Blockscout explorer URL for tx verification links
export const EXPLORER_URL = 'https://explorer.dogechain.dog';

// Limits
export const MAX_LOGS_PER_BATCH = 1000; // eth_getLogs max response entries
export const LOG_BLOCK_CHUNK_SIZE = 900; // blocks per eth_getLogs call (thirdweb limit ~1000)
export const MAX_BLOCKS_TO_SCAN_NATIVE = 10000; // practical limit for native tx scanning
export const MAX_BLOCK_BATCH_SIZE = 100; // blocks per eth_getBlockByNumber call
export const API_TIMEOUT_MS = 30000;
export const API_RATE_LIMIT_MS = 50; // ms between RPC calls (reduced from 200 — RPCs handle fast)

// CSV columns
export const CSV_COLUMNS = [
  'Tx Hash',
  'Block Number',
  'Timestamp (UTC)',
  'Type',
  'From',
  'To',
  'Value',
  'Token Address',
  'Token Symbol',
  'Token Amount',
  'Gas (Limit)',
  'Gas Price (Gwei)',
  'Status',
] as const;

export type TransactionRecord = string[];

const BLOCKSCOUT_API = 'https://explorer.dogechain.dog/api';
const PAGE_SIZE = 100; // Blockscout max per page

export interface ExportOptions {
  walletAddress: string;
}

export interface ExportProgress {
  phase: string;
  current: number;
  total?: number;
  message: string;
  recordCount: number;
}

export type ProgressCallback = (progress: ExportProgress) => void;

interface BlockscoutTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  nonce: string;
  // Token-specific fields (for tokentx endpoint)
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimal?: string;
  contractAddress?: string;
  // For tokentx, value is the token amount (already in human-readable in some cases)
}

interface BlockscoutTokenTx extends BlockscoutTx {
  tokenSymbol: string;
  tokenName: string;
  tokenDecimal: string;
  contractAddress: string;
  value: string;
}

type TransactionRecord = [
  string, // Tx Hash
  string, // Block Number
  string, // Timestamp (UTC)
  string, // Type (Send/Receive/Contract Call/Approval/etc)
  string, // From
  string, // To
  string, // Value (native)
  string, // Token Address
  string, // Token Symbol
  string, // Token Amount
  string, // Gas (Limit)
  string, // Gas Price (Gwei)
  string, // Status
];

function unixToUTC(timestamp: string): string {
  try {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return 'Unknown';
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  } catch {
    return 'Unknown';
  }
}

function hexWeiToDoge(hex: string, decimals = 18): string {
  try {
    const wei = BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
    if (wei === 0n) return '0';
    const divisor = 10n ** BigInt(decimals);
    const whole = wei / divisor;
    const frac = wei % divisor;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fracStr}`;
  } catch {
    return '0';
  }
}

function hexGasToGwei(hex: string): string {
  try {
    const wei = BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
    const gwei = wei / 10n ** 9n;
    return (Number(gwei) / 1000).toFixed(2);
  } catch {
    return '0';
  }
}

function classifyTx(from: string, to: string, wallet: string): string {
  const w = wallet.toLowerCase();
  const f = from.toLowerCase();
  const t = (to || '').toLowerCase();
  if (f === w && t === w) return 'Self';
  if (f === w) return 'Send';
  if (t === w) return 'Receive';
  return 'Unknown';
}

async function fetchPage(
  action: string,
  address: string,
  page: number,
  retries = 3,
): Promise<BlockscoutTx[]> {
  const url = `${BLOCKSCOUT_API}?module=account&action=${action}&address=${address}&page=${page}&offset=${PAGE_SIZE}&sort=asc`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DogechainExporter/1.0',
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 429) {
        // Rate limited — back off and retry
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(`Blockscout API rate limited (429). Please try again in a moment.`);
      }

      if (!res.ok) {
        throw new Error(`Blockscout API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.status !== '1' || !Array.isArray(data.result)) {
        return [];
      }

      return data.result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
      }
      throw err;
    }
  }

  return [];
}

const PAGE_DELAY_MS = 300; // Delay between pages to avoid rate limiting

/**
 * Fetch ALL pages from Blockscout API.
 * Pages are fetched sequentially with delays to avoid rate limiting.
 */
async function fetchAllPages(
  action: string,
  address: string,
  onProgress?: ProgressCallback,
): Promise<BlockscoutTx[]> {
  const allTxs: BlockscoutTx[] = [];
  let page = 1;

  while (true) {
    onProgress?.({
      phase: 'Fetching',
      current: allTxs.length,
      message: `Fetching page ${page}...`,
      recordCount: allTxs.length,
    });

    const txs = await fetchPage(action, address, page);

    if (txs.length === 0) break;

    allTxs.push(...txs);

    // If we got less than a full page, we're done
    if (txs.length < PAGE_SIZE) break;

    page++;

    // Delay between pages to avoid rate limiting
    if (page > 1) {
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }
  }

  return allTxs;
}

/**
 * Convert regular transactions to TransactionRecord format.
 */
function formatRegularTx(tx: BlockscoutTx, wallet: string): TransactionRecord {
  const type = classifyTx(tx.from, tx.to || '', wallet);
  const value = hexWeiToDoge(tx.value);
  const gasLimit = tx.gas ? String(parseInt(tx.gas, 16)) : 'N/A';
  const gasPrice = tx.gasPrice ? hexGasToGwei(tx.gasPrice) : '0';
  const status = tx.isError === '0' || tx.txreceipt_status === '1' ? 'Success' : 'Failed';

  // Detect contract interactions (non-zero input data that isn't a common function selector)
  const input = tx.input || '';
  const isContractCall = input.length > 10 && input !== '0x';
  const displayType = isContractCall && type === 'Send' ? 'Contract Call' : type;

  return [
    tx.hash,
    tx.blockNumber,
    unixToUTC(tx.timeStamp),
    displayType,
    tx.from,
    tx.to || 'Contract Creation',
    value,
    '', // no token address for native
    'DOGE',
    value, // native value = amount
    gasLimit,
    gasPrice,
    status,
  ];
}

/**
 * Convert token transactions to TransactionRecord format.
 */
function formatTokenTx(tx: BlockscoutTokenTx, wallet: string): TransactionRecord {
  const type = classifyTx(tx.from, tx.to || '', wallet);
  const decimals = parseInt(tx.tokenDecimal || '18', 10);
  const tokenAmount = hexWeiToDoge(tx.value, decimals);
  const gasLimit = tx.gas ? String(parseInt(tx.gas, 16)) : 'N/A';
  const gasPrice = tx.gasPrice ? hexGasToGwei(tx.gasPrice) : '0';
  const status = tx.isError === '0' || tx.txreceipt_status === '1' ? 'Success' : 'Failed';

  return [
    tx.hash,
    tx.blockNumber,
    unixToUTC(tx.timeStamp),
    type,
    tx.from,
    tx.to,
    '0', // native value is 0 for token transfers
    tx.contractAddress,
    tx.tokenSymbol,
    tokenAmount,
    gasLimit,
    gasPrice,
    status,
  ];
}

/**
 * Main export function using Blockscout Explorer API.
 * Fetches ALL transactions from genesis to current block.
 * No block range needed — the API covers the entire chain.
 */
export async function exportWalletData(
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<{ csv: string; recordCount: number }> {
  const { walletAddress } = options;

  if (!walletAddress) throw new Error('Wallet address is required');

  onProgress?.({
    phase: 'Starting',
    current: 0,
    total: 1,
    message: 'Connecting to Dogechain Explorer API...',
    recordCount: 0,
  });

  const address = walletAddress.toLowerCase();
  const allTransactions: TransactionRecord[] = [];

  // Fetch ALL transactions (native + token contracts)
  onProgress?.({
    phase: 'Fetching Transactions',
    current: 0,
    message: 'Fetching all transactions from genesis...',
    recordCount: 0,
  });

  const txs = await fetchAllPages('txlist', address, onProgress);

  // Also fetch dedicated token transfer list for better token data
  onProgress?.({
    phase: 'Fetching Token Transfers',
    current: txs.length,
    message: 'Fetching ERC20 token transfers...',
    recordCount: txs.length,
  });

  const tokenTxs = await fetchAllPages('tokentx', address, onProgress);

  // Build a map: token-formatted versions overwrite regular ones
  const txMap = new Map<string, TransactionRecord>();
  for (const tx of txs) {
    txMap.set(tx.hash, formatRegularTx(tx, address));
  }
  for (const tx of tokenTxs) {
    // Token version has richer metadata — always prefer it
    txMap.set(tx.hash, formatTokenTx(tx as BlockscoutTokenTx, address));
  }

  allTransactions.push(...txMap.values());

  onProgress?.({
    phase: 'Complete',
    current: allTransactions.length,
    total: allTransactions.length,
    message: `Found ${allTransactions.length} transactions`,
    recordCount: allTransactions.length,
  });

  // Sort by block number descending (newest first)
  allTransactions.sort((a, b) => parseInt(b[1]) - parseInt(a[1]));

  // Generate CSV
  const header = [
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
  ];
  const rows = allTransactions.map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
  );

  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

  return { csv, recordCount: allTransactions.length };
}

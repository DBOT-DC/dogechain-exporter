import { getLogs, getBlockByNumber, getLatestBlockNumber } from './rpc';
import { addressToTopic, normalizeAddress, hexWeiToValue, hexGasToGwei, hexTimestampToUTC, classifyTx } from './utils';
import {
  TRANSFER_EVENT_TOPIC,
  MAX_LOGS_PER_BATCH,
  LOG_BLOCK_CHUNK_SIZE,
  MAX_BLOCKS_TO_SCAN_NATIVE,
  DOGECHAIN_NATIVE_SYMBOL,
  API_RATE_LIMIT_MS,
} from './config';
import type { TransactionRecord } from './config';

export interface ExportOptions {
  walletAddress: string;
  tokenAddress?: string;
  mode: 'token' | 'native' | 'all';
  startBlock?: number;
  endBlock?: number;
  maxBlocks?: number;
}

export interface ExportProgress {
  phase: string;
  current: number;
  total?: number;
  message: string;
  recordCount: number;
}

type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Fetch ERC20 token transfers for a wallet via eth_getLogs.
 * Runs outgoing and incoming queries in parallel batches.
 */
async function fetchTokenTransfers(
  walletAddress: string,
  tokenAddress: string | undefined,
  startBlock: number,
  endBlock: number,
  onProgress?: ProgressCallback,
): Promise<TransactionRecord[]> {
  const transactions: TransactionRecord[] = [];
  const walletTopic = addressToTopic(walletAddress);
  const chunkSize = LOG_BLOCK_CHUNK_SIZE; // 900 blocks per call

  // Run outgoing and incoming in parallel
  const [outgoing, incoming] = await Promise.all([
    fetchTokenDirection(walletAddress, tokenAddress, walletTopic, startBlock, endBlock, chunkSize, 'outgoing', onProgress),
    fetchTokenDirection(walletAddress, tokenAddress, walletTopic, startBlock, endBlock, chunkSize, 'incoming', onProgress),
  ]);

  transactions.push(...outgoing, ...incoming);

  // Deduplicate by tx hash (a tx could appear in both outgoing and incoming if self-send)
  const seen = new Set<string>();
  const deduped: TransactionRecord[] = [];
  for (const tx of transactions) {
    if (!seen.has(tx[0])) {
      seen.add(tx[0]);
      deduped.push(tx);
    }
  }

  // Fetch timestamps in parallel batches of 10
  const uniqueBlocks = [...new Set(deduped.map((t) => t[1]))];
  const blockTimestamps = new Map<string, string>();
  // Fetch timestamps in parallel batches of 20
  for (let i = 0; i < uniqueBlocks.length; i += 20) {
    const batch = uniqueBlocks.slice(i, i + 20);
    await Promise.all(
      batch.map(async (blockStr) => {
        try {
          const block = await getBlockByNumber(parseInt(blockStr));
          if (block?.timestamp) {
            blockTimestamps.set(blockStr, hexTimestampToUTC(String(block.timestamp)));
          }
        } catch (err) {
          console.error(`Error fetching block ${blockStr}:`, err);
        }
      })
    );

    if (i % 50 === 0) {
      onProgress?.({
        phase: 'Fetching timestamps',
        current: i,
        total: uniqueBlocks.length,
        message: `Fetching block timestamps (${i}/${uniqueBlocks.length})`,
        recordCount: deduped.length,
      });
    }
  }

  // Fill in timestamps
  for (const tx of deduped) {
    tx[2] = blockTimestamps.get(tx[1]) || 'Unknown';
  }

  return deduped;
}

/**
 * Fetch token transfers in one direction (outgoing or incoming).
 */
async function fetchTokenDirection(
  walletAddress: string,
  tokenAddress: string | undefined,
  walletTopic: string,
  startBlock: number,
  endBlock: number,
  chunkSize: number,
  direction: 'outgoing' | 'incoming',
  onProgress?: ProgressCallback,
): Promise<TransactionRecord[]> {
  const transactions: TransactionRecord[] = [];
  let currentBlock = startBlock;

  // topic[1] = from, topic[2] = to
  const topics: (string | null)[] =
    direction === 'outgoing'
      ? [TRANSFER_EVENT_TOPIC, walletTopic, null]
      : [TRANSFER_EVENT_TOPIC, null, walletTopic];

  // Process chunks in parallel batches of 20
  const BATCH_SIZE = 20;

  while (currentBlock <= endBlock) {
    const batchPromises: Promise<void>[] = [];

    for (let b = 0; b < BATCH_SIZE && currentBlock <= endBlock; b++) {
      const fromBlock = currentBlock;
      const toBlock = Math.min(fromBlock + chunkSize, endBlock);
      currentBlock = toBlock + 1;

      batchPromises.push(
        (async () => {
          const filter: Parameters<typeof getLogs>[0] = {
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: '0x' + toBlock.toString(16),
            topics,
          };

          if (tokenAddress) {
            filter.address = normalizeAddress(tokenAddress);
          }

          let logs;
          try {
            logs = await getLogs(filter);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`Error fetching logs blocks ${fromBlock}-${toBlock}: ${errMsg}`);
            return;
          }

          if (!logs || logs.length === 0) return;

          for (const log of logs) {
            const logTopics = (log.topics as string[]) || [];
            const txHash = String(log.transactionHash);
            const blockNum = parseInt(String(log.blockNumber), 16);

            const topic1 = String(logTopics[1] || '');
            const topic2 = String(logTopics[2] || '');
            const fromAddr = topic1.length === 66 ? '0x' + topic1.slice(26) : topic1;
            const toAddr = topic2.length === 66 ? '0x' + topic2.slice(26) : topic2;

            const tokenAmount = log.data ? hexWeiToValue(String(log.data), 18) : '0';
            const type = classifyTx(fromAddr, toAddr, walletAddress);

            transactions.push([
              txHash,
              blockNum.toString(),
              '', // timestamp filled in later
              type,
              fromAddr,
              toAddr,
              'N/A',
              String(log.address || ''),
              '',
              tokenAmount,
              '', '', '',
            ]);
          }
        })()
      );
    }

    await Promise.all(batchPromises);

    onProgress?.({
      phase: 'Token Transfers',
      current: Math.min(currentBlock, endBlock) - startBlock,
      total: endBlock - startBlock,
      message: `Scanning ${direction} (${Math.min(currentBlock, endBlock).toLocaleString()} / ${endBlock.toLocaleString()})`,
      recordCount: transactions.length,
    });
  }

  return transactions;
}

/**
 * Fetch native DOGE transfers by scanning blocks.
 * Uses parallel batch fetching for speed.
 */
async function fetchNativeTransfers(
  walletAddress: string,
  startBlock: number,
  endBlock: number,
  onProgress?: ProgressCallback,
): Promise<TransactionRecord[]> {
  const transactions: TransactionRecord[] = [];
  const normalizedWallet = normalizeAddress(walletAddress);
  const totalBlocks = endBlock - startBlock + 1;

  // Process blocks in parallel batches of 20
  const BATCH_SIZE = 20;

  for (let i = startBlock; i <= endBlock; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE - 1, endBlock);
    const batchPromises: Promise<void>[] = [];

    for (let blockNum = i; blockNum <= batchEnd; blockNum++) {
      batchPromises.push(
        (async () => {
          try {
            const block = await getBlockByNumber(blockNum, true);
            if (!block) return;

            const timestamp = hexTimestampToUTC(String(block.timestamp));
            const txs = block.transactions as Record<string, unknown>[];

            for (const tx of txs) {
              const from = String(tx.from || '');
              const to = tx.to ? String(tx.to) : null;

              if (
                normalizeAddress(from) !== normalizedWallet &&
                (to === null || normalizeAddress(to) !== normalizedWallet)
              ) {
                continue;
              }

              const type = classifyTx(from, to || '', walletAddress);
              const value = hexWeiToValue(String(tx.value), 18);
              const gasLimit = tx.gas ? String(parseInt(String(tx.gas), 16)) : 'N/A';
              const gasPrice = tx.gasPrice ? hexGasToGwei(String(tx.gasPrice)) : '0';

              transactions.push([
                String(tx.hash),
                blockNum.toString(),
                timestamp,
                type,
                from,
                to || 'Contract Creation',
                value,
                '',
                DOGECHAIN_NATIVE_SYMBOL,
                value,
                gasLimit,
                gasPrice,
                'Success',
              ]);
            }
          } catch (err) {
            console.error(`Error scanning block ${blockNum}:`, err);
          }
        })()
      );
    }

    await Promise.all(batchPromises);

    if ((i - startBlock) % 500 === 0) {
      onProgress?.({
        phase: 'Native Transfers',
        current: i - startBlock,
        total: totalBlocks,
        message: `Scanning block ${i.toLocaleString()} / ${endBlock.toLocaleString()}`,
        recordCount: transactions.length,
      });
    }
  }

  return transactions;
}

/**
 * Main export function.
 */
export async function exportWalletData(
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<{ csv: string; recordCount: number }> {
  const {
    walletAddress,
    tokenAddress,
    mode,
    startBlock,
    endBlock,
    maxBlocks,
  } = options;

  if (!walletAddress) throw new Error('Wallet address is required');

  const latestBlock = endBlock || (await getLatestBlockNumber());
  // When maxBlocks is 0/undefined, scan from genesis
  const fromBlock = startBlock !== undefined
    ? startBlock
    : Math.max(0, latestBlock - (maxBlocks ?? 0));
  const effectiveEndBlock = endBlock || latestBlock;

  onProgress?.({
    phase: 'Starting',
    current: 0,
    total: 1,
    message: `Fetching data from block ${fromBlock.toLocaleString()} to ${effectiveEndBlock.toLocaleString()}`,
    recordCount: 0,
  });

  const allTransactions: TransactionRecord[] = [];

  if (mode === 'token' || mode === 'all') {
    const tokenTxs = await fetchTokenTransfers(
      walletAddress,
      tokenAddress,
      fromBlock,
      effectiveEndBlock,
      onProgress,
    );
    allTransactions.push(...tokenTxs);
  }

  if (mode === 'native' || mode === 'all') {
    const nativeEndBlock = Math.min(
      effectiveEndBlock,
      fromBlock + (maxBlocks || MAX_BLOCKS_TO_SCAN_NATIVE),
    );

    const nativeTxs = await fetchNativeTransfers(
      walletAddress,
      fromBlock,
      nativeEndBlock,
      onProgress,
    );
    allTransactions.push(...nativeTxs);
  }

  onProgress?.({
    phase: 'Complete',
    current: 1,
    total: 1,
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

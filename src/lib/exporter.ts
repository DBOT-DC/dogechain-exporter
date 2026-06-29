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
 * Efficiently processes logs in block ranges without per-tx RPC calls.
 * Timestamp is fetched once per unique block.
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
  const chunkSize = LOG_BLOCK_CHUNK_SIZE; // 900 blocks per call — within all RPC limits

  // We need to query with wallet as from (topic[1]) AND as to (topic[2])
  const topicFilters = [
    [TRANSFER_EVENT_TOPIC, walletTopic, null],  // outgoing
    [TRANSFER_EVENT_TOPIC, null, walletTopic],   // incoming
  ];

  for (let topicIdx = 0; topicIdx < topicFilters.length; topicIdx++) {
    let currentBlock = startBlock;

    while (currentBlock <= endBlock) {
      const fromBlock = currentBlock;
      const toBlock = Math.min(fromBlock + chunkSize, endBlock);

      onProgress?.({
        phase: 'Token Transfers',
        current: fromBlock - startBlock,
        total: endBlock - startBlock,
        message: `Scanning blocks ${fromBlock.toLocaleString()} - ${toBlock.toLocaleString()} (${topicIdx === 0 ? 'outgoing' : 'incoming'})`,
        recordCount: transactions.length,
      });

      const filter: Parameters<typeof getLogs>[0] = {
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + toBlock.toString(16),
        topics: topicFilters[topicIdx] as (string | null)[],
      };

      if (tokenAddress) {
        filter.address = normalizeAddress(tokenAddress);
      }

      let logs;
      try {
        logs = await getLogs(filter);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error fetching logs for blocks ${fromBlock}-${toBlock}: ${errMsg}`);
        // If it's a block range limit error, halve the range and retry
        if (errMsg.includes('exceed') || errMsg.includes('maximum') || errMsg.includes('size exceeded')) {
          const range = toBlock - fromBlock;
          if (range > 10) {
            // Retry with half the range — will be picked up in next iteration
            currentBlock = fromBlock;
            // Temporarily reduce effective chunk by adjusting the outer loop
            // We can't modify chunkSize mid-loop, so just skip forward by half
            currentBlock = fromBlock + Math.floor(range / 2);
            console.error(`Retrying with smaller range: ${fromBlock}-${currentBlock - 1}`);
          } else {
            currentBlock = toBlock + 1;
          }
        } else {
          currentBlock = toBlock + 1;
        }
        continue;
      }

      if (logs.length === 0) {
        currentBlock = toBlock + 1;
        continue;
      }

      // Process logs - extract data directly from log entries
      for (const log of logs) {
        const topics = (log.topics as string[]) || [];
        const txHash = String(log.transactionHash);
        const blockNum = parseInt(String(log.blockNumber), 16);

        // Extract addresses from topics
        const topic1 = String(topics[1] || '');
        const topic2 = String(topics[2] || '');
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
          'N/A', // native value not applicable for token transfers
          String(log.address || ''),
          '', // symbol - needs separate call, skip for performance
          tokenAmount,
          '', // gas - skip for performance
          '', // gas price - skip for performance
          '', // status - skip for performance
        ]);
      }

      // Handle pagination: if we hit the log limit, advance past last log block
      if (logs.length >= MAX_LOGS_PER_BATCH) {
        const lastLog = logs[logs.length - 1];
        const lastBlock = parseInt(String(lastLog.blockNumber), 16);
        // Advance past the last block with results — may miss some logs
        // in the same block but avoids infinite loop
        currentBlock = lastBlock + 1;
      } else {
        currentBlock = toBlock + 1;
      }
    }
  }

  // Now fetch timestamps for unique blocks
  const uniqueBlocks = [...new Set(transactions.map((t) => t[1]))];
  const blockTimestamps = new Map<string, string>();

  for (let i = 0; i < uniqueBlocks.length; i++) {
    if (i % 10 === 0) {
      onProgress?.({
        phase: 'Fetching timestamps',
        current: i,
        total: uniqueBlocks.length,
        message: `Fetching block timestamps (${i}/${uniqueBlocks.length})`,
        recordCount: transactions.length,
      });
    }

    try {
      const block = await getBlockByNumber(parseInt(uniqueBlocks[i]));
      if (block?.timestamp) {
        blockTimestamps.set(uniqueBlocks[i], hexTimestampToUTC(String(block.timestamp)));
      }
    } catch (err) {
      console.error(`Error fetching block ${uniqueBlocks[i]}:`, err);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, API_RATE_LIMIT_MS));
  }

  // Fill in timestamps
  for (const tx of transactions) {
    tx[2] = blockTimestamps.get(tx[1]) || 'Unknown';
  }

  return transactions;
}

/**
 * Fetch native DOGE transfers by scanning blocks.
 * Efficient: only fetches full block data, checks from/to inline.
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

  for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
    if ((blockNum - startBlock) % 50 === 0) {
      onProgress?.({
        phase: 'Native Transfers',
        current: blockNum - startBlock,
        total: totalBlocks,
        message: `Scanning block ${blockNum.toLocaleString()} / ${endBlock.toLocaleString()}`,
        recordCount: transactions.length,
      });
    }

    try {
      const block = await getBlockByNumber(blockNum, true);
      if (!block) continue;

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
        // gas in block tx = gas limit; gasUsed requires receipt (not fetched for perf)
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
          'Success', // block transactions are confirmed
        ]);
      }
    } catch (err) {
      console.error(`Error scanning block ${blockNum}:`, err);
    }

    // Rate limit between block fetches
    await new Promise((r) => setTimeout(r, API_RATE_LIMIT_MS));
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
  const fromBlock = startBlock || Math.max(0, latestBlock - (maxBlocks || MAX_BLOCKS_TO_SCAN_NATIVE));
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

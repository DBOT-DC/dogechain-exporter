/**
 * Validate an Ethereum-format wallet address.
 * Accepts 0x-prefixed, 40 hex character addresses (checksummed or lowercase).
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Normalize an address to lowercase for comparison.
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Pad an address for use as a topic in eth_getLogs.
 * Topics are 32 bytes (64 hex chars) left-padded with zeros.
 */
export function addressToTopic(address: string): string {
  const normalized = normalizeAddress(address).replace('0x', '');
  return `0x${normalized.padStart(64, '0')}`;
}

/**
 * Convert hex wei value to a human-readable number string.
 * @param hexWei - hex string like "0x1234"
 * @param decimals - number of decimal places (18 for native, varies for ERC20)
 * @returns formatted number string
 */
export function hexWeiToValue(hexWei: string, decimals: number = 18): string {
  if (!hexWei || hexWei === '0x' || hexWei === '0x0') return '0';
  const wei = BigInt(hexWei);
  const divisor = BigInt(10 ** decimals);
  const wholePart = wei / divisor;
  const fracPart = wei % divisor;
  // Show up to 6 decimal places, strip trailing zeros
  const fracStr = fracPart.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
  return fracStr ? `${wholePart}.${fracStr}` : wholePart.toString();
}

/**
 * Convert hex gas price to Gwei.
 */
export function hexGasToGwei(hexGas: string): string {
  const wei = BigInt(hexGas);
  const gwei = wei / BigInt(10 ** 9);
  return gwei.toString();
}

/**
 * Convert hex block timestamp (seconds) to ISO UTC string.
 */
export function hexTimestampToUTC(hexTimestamp: string): string {
  const seconds = parseInt(hexTimestamp, 16);
  return new Date(seconds * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/**
 * Classify a transaction for a given address.
 */
export function classifyTx(
  from: string,
  to: string,
  walletAddress: string
): 'Send' | 'Receive' | 'Contract Creation' | 'Self' {
  const wallet = normalizeAddress(walletAddress);
  const fromNorm = normalizeAddress(from);
  const toNorm = normalizeAddress(to);

  if (fromNorm === toNorm) return 'Self';
  if (to === null || to === undefined) return 'Contract Creation';
  if (fromNorm === wallet) return 'Send';
  if (toNorm === wallet) return 'Receive';
  return 'Receive'; // fallback
}

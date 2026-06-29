import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress, normalizeAddress } from '@/lib/utils';
import { exportWalletData } from '@/lib/exporter';
import type { ExportProgress } from '@/lib/exporter';

// In-memory progress tracking for SSE (keyed by request ID)
const progressMap = new Map<string, ExportProgress>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address') || '';
  const tokenAddress = searchParams.get('token') || undefined;
  const mode = (searchParams.get('mode') || 'token') as 'token' | 'native' | 'all';
  const startBlock = searchParams.get('start') ? parseInt(searchParams.get('start')!) : undefined;
  const endBlock = searchParams.get('end') ? parseInt(searchParams.get('end')!) : undefined;
  const max = searchParams.get('max');
  const maxBlocks = max ? (parseInt(max) === 0 ? undefined : parseInt(max)) : undefined;

  // Validate address
  if (!isValidAddress(address)) {
    return NextResponse.json(
      { error: 'Invalid address. Please provide a valid 0x-prefixed Ethereum address.' },
      { status: 400 },
    );
  }

  // Validate token address if provided
  if (tokenAddress && !isValidAddress(tokenAddress)) {
    return NextResponse.json(
      { error: 'Invalid token address.' },
      { status: 400 },
    );
  }

  // Validate mode
  if (!['token', 'native', 'all'].includes(mode)) {
    return NextResponse.json(
      { error: 'Invalid mode. Must be token, native, or all.' },
      { status: 400 },
    );
  }

  try {
    const result = await exportWalletData(
      {
        walletAddress: normalizeAddress(address),
        tokenAddress: tokenAddress ? normalizeAddress(tokenAddress) : undefined,
        mode,
        startBlock,
        endBlock,
        maxBlocks,
      },
      (progress) => {
        progressMap.set(normalizeAddress(address), progress);
      },
    );

    // Clean up progress
    progressMap.delete(normalizeAddress(address));

    // Return CSV file
    const csvBuffer = Buffer.from(result.csv, 'utf-8');
    const filename = `dogechain-export-${address.slice(0, 10)}-${Date.now()}.csv`;

    return new NextResponse(csvBuffer, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Record-Count': result.recordCount.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Export error:', message);
    return NextResponse.json(
      { error: `Export failed: ${message}` },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress, normalizeAddress } from '@/lib/utils';
import { exportWalletData } from '@/lib/exporter';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address') || '';

  if (!isValidAddress(address)) {
    return NextResponse.json(
      { error: 'Invalid address. Please provide a valid 0x-prefixed Ethereum address.' },
      { status: 400 },
    );
  }

  try {
    const result = await exportWalletData({
      walletAddress: normalizeAddress(address),
    });

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

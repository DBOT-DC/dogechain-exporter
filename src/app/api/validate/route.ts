import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || !isValidAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  // Quick validation endpoint - just checks if address is valid
  return NextResponse.json({
    valid: true,
    address: address.toLowerCase(),
    message: 'Address is valid. Ready to export.',
  });
}

import { NextRequest } from 'next/server';
import { isValidAddress, normalizeAddress } from '@/lib/utils';
import { exportWalletData, ProgressCallback, ExportProgress } from '@/lib/exporter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address') || '';

  if (!isValidAddress(address)) {
    return new Response(JSON.stringify({ error: 'Invalid address' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  function sendSSE(event: string, data: unknown) {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const onProgress: ProgressCallback = (event: ExportProgress) => {
          controller.enqueue(encoder.encode(sendSSE('progress', event)));
        };

        const result = await exportWalletData(
          { walletAddress: normalizeAddress(address) },
          onProgress,
        );

        // Send the CSV as a base64-encoded event
        const base64 = Buffer.from(result.csv, 'utf-8').toString('base64');
        controller.enqueue(
          encoder.encode(
            sendSSE('complete', {
              recordCount: result.recordCount,
              csvBase64: base64,
            }),
          ),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred';
        controller.enqueue(
          encoder.encode(sendSSE('error', { message })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

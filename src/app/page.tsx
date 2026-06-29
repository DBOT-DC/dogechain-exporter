'use client';

import { useState, useCallback, useRef } from 'react';

type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

interface ProgressState {
  phase: string;
  message: string;
  recordCount: number;
  page: number;
  totalPages?: number;
  percent: number;
}

function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function IconCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function IconBroadcast({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
    </svg>
  );
}

function IconCoins({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75m16.5 3.75v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
    </svg>
  );
}

function IconDocument({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function IconBolt({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

function IconSpinner({ className = 'w-4 h-4 animate-spin' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
    </svg>
  );
}

const INITIAL_PROGRESS: ProgressState = {
  phase: '',
  message: '',
  recordCount: 0,
  page: 0,
  totalPages: undefined,
  percent: 0,
};

export default function Home() {
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(address);

  const handleExport = useCallback(async () => {
    if (!isValid) return;
    setStatus('exporting');
    setError('');
    setProgress({ ...INITIAL_PROGRESS, phase: 'Starting', message: 'Connecting...' });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const response = await fetch(`/api/export?address=${address.toLowerCase()}`, {
        signal: abort.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!response.body) throw new Error('No response stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (currentEvent === 'progress') {
                // Calculate estimated percentage based on phase and record count
                let percent = 0;
                const phase = data.phase || '';
                const count = data.recordCount || 0;
                const msg = data.message || '';

                if (phase === 'Starting') {
                  percent = 2;
                } else if (phase === 'Fetching Transactions') {
                  // Extract page number from message like "Fetching page 23..."
                  const pageMatch = msg.match(/page (\d+)/);
                  const page = pageMatch ? parseInt(pageMatch[1]) : 1;
                  // Estimate: ~100 records/page, 2 phases, each roughly equal
                  // Phase 1 (txlist) is roughly 0-45%, Phase 2 (tokentx) is 45-90%
                  percent = Math.min(45, 2 + (page - 1) * 1.5);
                  setProgress({
                    phase,
                    message: `Fetching transactions — page ${page} (${count.toLocaleString()} found)`,
                    recordCount: count,
                    page,
                    percent: Math.round(percent),
                  });
                  continue;
                } else if (phase === 'Fetching Token Transfers') {
                  const pageMatch = msg.match(/page (\d+)/);
                  const page = pageMatch ? parseInt(pageMatch[1]) : 1;
                  percent = 45 + Math.min(45, (page - 1) * 1.5);
                  setProgress({
                    phase,
                    message: `Fetching token transfers — page ${page} (${count.toLocaleString()} found)`,
                    recordCount: count,
                    page,
                    percent: Math.round(percent),
                  });
                  continue;
                } else if (phase === 'Complete') {
                  percent = 92;
                }

                if (currentEvent !== 'progress' || !phase.includes('Fetching')) {
                  setProgress((prev) => ({
                    ...prev,
                    phase,
                    message: data.message || prev.message,
                    recordCount: count,
                    percent: Math.round(Math.max(prev.percent, percent)),
                  }));
                }
              } else if (currentEvent === 'complete') {
                setProgress((prev) => ({
                  ...prev,
                  phase: 'Done',
                  message: `Download complete — ${(data.recordCount || 0).toLocaleString()} transactions exported.`,
                  recordCount: data.recordCount || 0,
                  percent: 100,
                }));

                // Decode CSV and trigger download
                const csv = atob(data.csvBase64);
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dogechain-export-${address.slice(0, 10)}-${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setStatus('done');
              } else if (currentEvent === 'error') {
                throw new Error(data.message || 'Export failed');
              }
            } catch (parseErr) {
              if (!(parseErr instanceof SyntaxError)) throw parseErr;
            }
          }
        }
      }

      if (status !== 'done') {
        setStatus('done');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setProgress(INITIAL_PROGRESS);
    } finally {
      abortRef.current = null;
    }
  }, [address, isValid]);

  return (
    <main className="mx-auto max-w-xl px-5 py-16 sm:py-24 fade-in">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#7b6ffc]/20 bg-[#7b6ffc]/5 px-4 py-1.5 text-xs font-medium text-[#7b6ffc]/90">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7b6ffc] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7b6ffc]" />
          </span>
          Dogechain shutting down ~Aug 7 — export now
        </div>
        <h1 className="mb-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="shimmer-text">Dogechain</span>{' '}
          <span className="text-white">Data Exporter</span>
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-white/70">
          Export your wallet&apos;s complete transaction history to CSV.
          All data, from genesis to current block. No sign-up, no limits.
        </p>
      </div>

      {/* Main Card */}
      <div className="glass-card gradient-border rounded-2xl p-6 sm:p-8">
        {/* Address Input */}
        <div className="mb-5">
          <label
            htmlFor="address"
            className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70"
          >
            Wallet Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            className={`modern-input w-full px-4 py-3.5 font-mono text-sm text-white ${
              address && !isValid ? 'error' : ''
            }`}
            disabled={status === 'exporting'}
          />
          {address && !isValid && (
            <p className="mt-1.5 text-xs text-red-400/90">
              Must be a valid 0x-prefixed address (42 characters)
            </p>
          )}
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={!isValid || status === 'exporting'}
          className="btn-gradient w-full flex items-center justify-center gap-2 px-6 py-4 text-base text-white"
        >
          {status === 'exporting' ? (
            <>
              <IconSpinner />
              Exporting...
            </>
          ) : status === 'done' ? (
            <>
              <IconCheck />
              Downloaded — Export Again?
            </>
          ) : (
            <>
              <IconDownload />
              Full Export
            </>
          )}
        </button>
      </div>

      {/* Progress Section */}
      {status === 'exporting' && progress.percent > 0 && (
        <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm fade-in">
          <div className="flex items-center justify-between text-white/70">
            <span>{progress.message}</span>
            <span className="ml-3 flex-shrink-0 text-xs font-medium text-[#7b6ffc]">
              {progress.percent}%
            </span>
          </div>
          <div className="mt-3">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
          {progress.recordCount > 0 && (
            <p className="mt-2 text-xs text-[#82899a]">
              {progress.recordCount.toLocaleString()} transactions found so far
            </p>
          )}
        </div>
      )}

      {/* Status Messages */}
      {status === 'done' && (
        <div className="mt-5 rounded-xl border border-[#7b6ffc]/20 bg-[#7b6ffc]/5 p-4 text-sm text-[#7b6ffc] fade-in">
          <p>{progress.message}</p>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-5 rounded-xl border border-[#fb5c5c]/20 bg-[#fb5c5c]/5 p-4 text-sm text-[#fb5c5c] fade-in">
          <p>{error}</p>
        </div>
      )}

      {/* How It Works */}
      <div className="info-card mt-10 p-6">
        <h2 className="mb-4 text-base font-semibold text-white">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: <IconBroadcast />,
              title: 'Explorer API',
              desc: 'Queries the Dogechain Blockscout explorer. Indexed data — no raw RPC scanning.',
            },
            {
              icon: <IconCoins />,
              title: 'Full History',
              desc: 'Every transaction from genesis to current block. All 60M+ blocks covered.',
            },
            {
              icon: <IconDocument />,
              title: 'Clean CSV',
              desc: '13 columns: hash, block, time, type, from, to, token, amount, gas, status.',
            },
            {
              icon: <IconBolt />,
              title: 'Fast Download',
              desc: 'Indexed data returns in seconds, not minutes. Generated server-side.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-lg bg-white/[0.03] p-3.5">
              <div className="mb-1.5 text-[#7b6ffc]">{icon}</div>
              <h3 className="mb-1 text-sm font-medium text-white">{title}</h3>
              <p className="text-xs leading-relaxed text-[#82899a]">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center">
        <p className="text-xs text-[#82899a]">
          Free &amp; Open Source • MIT License •{' '}
          <a
            href="https://github.com/DBOT-DC/dogechain-exporter"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#82899a] transition-colors hover:text-[#7b6ffc]"
          >
            GitHub
          </a>
        </p>
        <p className="mt-1.5 text-xs text-[#82899a]">
          Made by{' '}
          <a
            href="https://dbot.dog"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#7b6ffc] transition-colors hover:text-[#9d8ffc]"
          >
            DBOT
          </a>{' '}
          •{' '}
          <a
            href="https://github.com/DBOT-DC"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#82899a] transition-colors hover:text-[#7b6ffc]"
          >
            DBOT-DC
          </a>{' '}
          on GitHub
        </p>
      </footer>
    </main>
  );
}

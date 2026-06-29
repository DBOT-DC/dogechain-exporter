'use client';

import { useState, useCallback } from 'react';

type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

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

function IconClock({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

export default function Home() {
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState('');
  const [recordCount, setRecordCount] = useState(0);
  const [error, setError] = useState('');

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(address);

  const handleExport = useCallback(async () => {
    if (!isValid) return;
    setStatus('exporting');
    setError('');
    setProgress('Connecting to Dogechain Explorer API...');
    setRecordCount(0);

    try {
      setProgress('Fetching complete transaction history...');
      const response = await fetch(`/api/export?address=${address.toLowerCase()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const count = response.headers.get('X-Record-Count');
      setRecordCount(parseInt(count || '0'));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dogechain-export-${address.slice(0, 10)}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('done');
      setProgress(`Download complete — ${count || 0} transactions exported.`);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setProgress('');
    }
  }, [address, isValid]);

  return (
    <main className="mx-auto max-w-xl px-5 py-16 sm:py-24 fade-in">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-xs font-medium text-amber-400/80">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          Dogechain shutting down ~Aug 7 — export now
        </div>
        <h1 className="mb-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="shimmer-text">Dogechain</span>{' '}
          <span className="text-white">Data Exporter</span>
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-400">
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
            className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-300"
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
          className="btn-gradient w-full flex items-center justify-center gap-2 px-6 py-4 text-base text-gray-900"
        >
          {status === 'exporting' ? (
            <>
              <IconSpinner />
              Exporting Full History...
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

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <IconClock className="w-3.5 h-3.5" />
          All transactions from genesis — no range needed
        </p>
      </div>

      {/* Status Messages */}
      {(progress || error) && (
        <div
          className={`mt-5 rounded-xl border p-4 text-sm fade-in ${
            error
              ? 'border-red-500/20 bg-red-500/5 text-red-300'
              : status === 'done'
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                : 'border-white/5 bg-white/[0.02] text-gray-300'
          }`}
        >
          {error && <p>{error}</p>}
          {progress && !error && <p>{progress}</p>}
          {recordCount > 0 && !error && (
            <p className="mt-1 text-xs opacity-60">
              {recordCount} transaction{recordCount !== 1 ? 's' : ''} found
            </p>
          )}
          {status === 'exporting' && (
            <div className="mt-3">
              <div className="progress-bar">
                <div className="progress-bar-fill" />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Fetching from Dogechain Explorer API...
              </p>
            </div>
          )}
        </div>
      )}

      {/* How It Works */}
      <div className="info-card mt-10 p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-200">How it works</h2>
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
            <div key={title} className="rounded-lg bg-white/[0.02] p-3.5">
              <div className="mb-1.5 text-amber-400/80">{icon}</div>
              <h3 className="mb-1 text-sm font-medium text-gray-200">{title}</h3>
              <p className="text-xs leading-relaxed text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center">
        <p className="text-xs text-gray-600">
          Free &amp; Open Source • MIT License •{' '}
          <a
            href="https://github.com/DBOT-DC/dogechain-exporter"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 transition-colors hover:text-amber-400"
          >
            GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}

'use client';

import { useState, useCallback } from 'react';

type ExportMode = 'token' | 'native' | 'all';
type ExportStatus = 'idle' | 'validating' | 'exporting' | 'done' | 'error';

export default function Home() {
  const [address, setAddress] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [mode, setMode] = useState<ExportMode>('token');
  const [maxBlocks, setMaxBlocks] = useState('1000000');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState('');
  const [recordCount, setRecordCount] = useState(0);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(address);
  const isTokenValid = tokenAddress === '' || /^0x[0-9a-fA-F]{40}$/.test(tokenAddress);
  const isAdvanced = mode === 'native' || mode === 'all';

  const handleExport = useCallback(async () => {
    if (!isValid || !isTokenValid) return;
    setStatus('exporting');
    setError('');
    setProgress('Connecting to Dogechain RPC...');
    setRecordCount(0);

    try {
      const params = new URLSearchParams({
        address: address.toLowerCase(),
        mode,
        max: maxBlocks,
      });
      if (tokenAddress && mode === 'token') {
        params.set('token', tokenAddress.toLowerCase());
      }
      setProgress('Fetching blockchain data...');
      const response = await fetch(`/api/export?${params.toString()}`);
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
  }, [address, tokenAddress, mode, maxBlocks, isValid, isTokenValid]);

  const handleReset = () => {
    setStatus('idle');
    setProgress('');
    setRecordCount(0);
    setError('');
  };

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
          Export your wallet&apos;s ERC20 token transfers to CSV.
          No sign-up, no API keys, no limits.
        </p>
      </div>

      {/* Main Card */}
      <div className="glass-card gradient-border rounded-2xl p-6 sm:p-8">
        {/* Address Input */}
        <div className="mb-5">
          <label
            htmlFor="address"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Wallet Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (status !== 'idle') handleReset();
            }}
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

        {/* Token Address */}
        <div className="mb-6">
          <label
            htmlFor="token"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Token Contract{' '}
            <span className="text-gray-500 font-normal">(optional — blank for all)</span>
          </label>
          <input
            id="token"
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="0x... leave blank for all tokens"
            className={`modern-input w-full px-4 py-3.5 font-mono text-sm text-white ${
              tokenAddress && !isTokenValid ? 'error' : ''
            }`}
            disabled={status === 'exporting'}
          />
          {tokenAddress && !isTokenValid && (
            <p className="mt-1.5 text-xs text-red-400/90">Invalid contract address</p>
          )}
        </div>

        {/* Block Range */}
        <div className="mb-6">
          <label
            htmlFor="maxBlocks"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Block Range
          </label>
          <select
            id="maxBlocks"
            value={maxBlocks}
            onChange={(e) => setMaxBlocks(e.target.value)}
            disabled={status === 'exporting'}
            className="modern-select w-full px-4 py-3.5 text-sm text-white"
          >
            <option value="100">Last 100 blocks (recent)</option>
            <option value="1000">Last 1,000 blocks</option>
            <option value="10000">Last 10,000 blocks</option>
            <option value="100000">Last 100,000 blocks</option>
            <option value="1000000">Last 1,000,000 blocks</option>
            <option value="0">All Time (from genesis)</option>
          </select>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={!isValid || !isTokenValid || status === 'exporting'}
          className="btn-gradient w-full px-6 py-4 text-base text-gray-900"
        >
          {status === 'exporting'
            ? '⏳ Exporting...'
            : status === 'done'
              ? '✅ Downloaded — Export Again?'
              : '📥 Export ERC20 Transfers'}
        </button>

        {/* Advanced Toggle */}
        <button
          onClick={() => {
            setShowAdvanced(!showAdvanced);
            if (showAdvanced && isAdvanced) setMode('token');
          }}
          className="mt-5 w-full text-center text-xs text-gray-500 transition-colors hover:text-gray-400"
        >
          {showAdvanced ? '▲ Hide advanced options' : '▼ Advanced: Native DOGE scanning'}
        </button>

        {/* Advanced Panel */}
        {showAdvanced && (
          <div className="advanced-panel mt-4 p-4">
            <div className="mb-3 flex items-start gap-2">
              <span className="mt-0.5 text-yellow-400">⚠️</span>
              <p className="text-xs leading-relaxed text-yellow-400/80">
                Native DOGE scans blocks one-by-one via RPC.
                <strong className="text-yellow-400"> 100 blocks ≈ 20 seconds.</strong>{' '}
                Keep ranges small.
              </p>
            </div>
            <div className="flex gap-2">
              {(['native', 'all'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={status === 'exporting'}
                  className={`btn-pill flex-1 px-3 py-2.5 text-xs font-medium ${
                    mode === m ? 'active' : 'text-gray-400'
                  } disabled:opacity-40`}
                >
                  {m === 'native' ? 'Native DOGE Only' : 'All (Tokens + DOGE)'}
                </button>
              ))}
            </div>
          </div>
        )}
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
          {error && <p>❌ {error}</p>}
          {progress && !error && <p>{progress}</p>}
          {recordCount > 0 && !error && (
            <p className="mt-1 text-xs opacity-60">{recordCount} transaction{recordCount !== 1 ? 's' : ''} found</p>
          )}
          {status === 'exporting' && (
            <div className="mt-3">
              <div className="progress-bar">
                <div className="progress-bar-fill" />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {isAdvanced
                  ? 'Scanning blocks via RPC — this will take a while.'
                  : 'Fetching transfer logs via RPC...'}
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
              icon: '📡',
              title: 'RPC Direct',
              desc: 'Queries Dogechain nodes directly. No API keys, no middlemen.',
            },
            {
              icon: '🪙',
              title: 'ERC20 Logs',
              desc: 'Indexed Transfer events via eth_getLogs. 100K blocks in ~1 second.',
            },
            {
              icon: '📄',
              title: 'Clean CSV',
              desc: '13 columns: hash, block, time, type, from, to, token, amount, gas, status.',
            },
            {
              icon: '⚡',
              title: 'Instant Download',
              desc: 'Generated server-side, streamed to your browser. No data stored.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-lg bg-white/[0.02] p-3.5">
              <div className="mb-1.5 text-lg">{icon}</div>
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

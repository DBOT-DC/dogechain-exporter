'use client';

import { useState, useCallback } from 'react';

type ExportMode = 'token' | 'native' | 'all';
type ExportStatus = 'idle' | 'validating' | 'exporting' | 'done' | 'error';

export default function Home() {
  const [address, setAddress] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [mode, setMode] = useState<ExportMode>('token');
  const [maxBlocks, setMaxBlocks] = useState('10000');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState('');
  const [recordCount, setRecordCount] = useState(0);
  const [error, setError] = useState('');

  const isValid =
    /^0x[0-9a-fA-F]{40}$/.test(address);
  const isTokenValid =
    tokenAddress === '' || /^0x[0-9a-fA-F]{40}$/.test(tokenAddress);

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

      setProgress('Fetching blockchain data... This may take a moment.');

      const response = await fetch(`/api/export?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const count = response.headers.get('X-Record-Count');
      setRecordCount(parseInt(count || '0'));

      // Download CSV
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
      setProgress(`Download complete! ${count || 0} transactions exported.`);
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
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
    <main className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">
          🐕 Dogechain Data Exporter
        </h1>
        <p className="text-gray-400">
          Export your wallet&apos;s on-chain transaction history to CSV.
          <br />
          <span className="text-sm text-gray-500">
            Free &amp; open source • No API keys required • Works with ERC20 tokens
            &amp; native DOGE
          </span>
        </p>
      </div>

      {/* Main Card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
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
            className={`w-full rounded-lg border bg-gray-800 px-4 py-3 font-mono text-sm placeholder-gray-600 transition-colors focus:outline-none focus:ring-2 ${
              address && !isValid
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-700 focus:ring-amber-500'
            }`}
            disabled={status === 'exporting'}
          />
          {address && !isValid && (
            <p className="mt-1 text-xs text-red-400">
              Must be a valid 0x-prefixed address (42 characters)
            </p>
          )}
        </div>

        {/* Mode Selection */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Export Type
          </label>
          <div className="flex gap-2">
            {(['token', 'native', 'all'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={status === 'exporting'}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                } disabled:opacity-50`}
              >
                {m === 'token'
                  ? 'ERC20 Tokens'
                  : m === 'native'
                    ? 'Native DOGE'
                    : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Optional: Token Address */}
        {mode === 'token' && (
          <div className="mb-5">
            <label
              htmlFor="token"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Token Contract Address{' '}
              <span className="text-gray-500">(optional — all tokens if blank)</span>
            </label>
            <input
              id="token"
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x... (leave blank for all tokens)"
              className={`w-full rounded-lg border bg-gray-800 px-4 py-3 font-mono text-sm placeholder-gray-600 transition-colors focus:outline-none focus:ring-2 ${
                tokenAddress && !isTokenValid
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-700 focus:ring-amber-500'
              }`}
              disabled={status === 'exporting'}
            />
            {tokenAddress && !isTokenValid && (
              <p className="mt-1 text-xs text-red-400">
                Invalid token contract address
              </p>
            )}
          </div>
        )}

        {/* Max Blocks */}
        <div className="mb-6">
          <label
            htmlFor="maxBlocks"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Max Blocks to Scan{' '}
            <span className="text-gray-500">
              (lower = faster • native DOGE scans block-by-block)
            </span>
          </label>
          <select
            id="maxBlocks"
            value={maxBlocks}
            onChange={(e) => setMaxBlocks(e.target.value)}
            disabled={status === 'exporting'}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="100">100 blocks (~3 min)</option>
            <option value="1000">1,000 blocks (~30 min)</option>
            <option value="10000">10,000 blocks (~5.5 hrs)</option>
            <option value="100000">100,000 blocks (~2.3 days)</option>
            <option value="1000000">1,000,000 blocks (~23 days)</option>
          </select>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={!isValid || !isTokenValid || status === 'exporting'}
          className="w-full rounded-lg bg-amber-500 px-6 py-3 font-bold text-gray-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-amber-500"
        >
          {status === 'exporting'
            ? '⏳ Exporting...'
            : status === 'done'
              ? '✅ Downloaded — Export Again?'
              : '📥 Export to CSV'}
        </button>
      </div>

      {/* Status Messages */}
      {(progress || error) && (
        <div
          className={`mt-4 rounded-lg border p-4 text-sm ${
            error
              ? 'border-red-800 bg-red-900/20 text-red-300'
              : status === 'done'
                ? 'border-green-800 bg-green-900/20 text-green-300'
                : 'border-gray-800 bg-gray-900 text-gray-300'
          }`}
        >
          {error && <p>❌ {error}</p>}
          {progress && !error && <p>{progress}</p>}
          {status === 'exporting' && (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full animate-pulse rounded-full bg-amber-500"
                  style={{ width: '60%' }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Scanning blockchain data via RPC. This may take several minutes
                depending on block range and activity.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="mb-3 text-lg font-semibold text-gray-200">
          ℹ️ How It Works
        </h2>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>
            📡{' '}
            <strong className="text-gray-300">Data Source:</strong> Fetches
            directly from Dogechain RPC nodes (no API key needed).
            Blockscout explorer API is currently unavailable.
          </li>
          <li>
            🪙{' '}
            <strong className="text-gray-300">Token Transfers:</strong> Uses
            eth_getLogs to efficiently find ERC20 Transfer events indexed by
            your wallet address. Fast and scalable.
          </li>
          <li>
            🐶{' '}
            <strong className="text-gray-300">Native DOGE:</strong> Scans blocks
            one-by-one to find transactions where your address is sender or
            receiver. Slower — limit block range accordingly.
          </li>
          <li>
            ⚠️{' '}
            <strong className="text-gray-300">Note:</strong> Dogechain is
            shutting down ~August 7, 2026. Export your data before then!
          </li>
        </ul>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-gray-600">
        <p>
          Free &amp; Open Source • MIT License •{' '}
          <a
            href="https://github.com/pennybags/dogechain-exporter"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 underline hover:text-gray-400"
          >
            GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}

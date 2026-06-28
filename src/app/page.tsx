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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isValid =
    /^0x[0-9a-fA-F]{40}$/.test(address);
  const isTokenValid =
    tokenAddress === '' || /^0x[0-9a-fA-F]{40}$/.test(tokenAddress);
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
          Export your wallet&apos;s ERC20 token transfers to CSV.
          <br />
          <span className="text-sm text-gray-500">
            Free &amp; open source • No API keys required • Before Dogechain shuts down ~Aug 7
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

        {/* Optional: Token Address (always visible for ERC20) */}
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

        {/* Max Blocks (default, non-scary label) */}
        <div className="mb-6">
          <label
            htmlFor="maxBlocks"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Block Range{' '}
            <span className="text-gray-500">
              (how far back to search)
            </span>
          </label>
          <select
            id="maxBlocks"
            value={maxBlocks}
            onChange={(e) => setMaxBlocks(e.target.value)}
            disabled={status === 'exporting'}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="100">100 blocks (recent)</option>
            <option value="1000">1,000 blocks (~hours)</option>
            <option value="10000">10,000 blocks</option>
            <option value="100000">100,000 blocks</option>
            <option value="1000000">1,000,000 blocks</option>
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
              : '📥 Export ERC20 Transfers to CSV'}
        </button>

        {/* Advanced Options Toggle */}
        <button
          onClick={() => {
            setShowAdvanced(!showAdvanced);
            if (showAdvanced && isAdvanced) {
              setMode('token');
            }
          }}
          className="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          {showAdvanced ? '▲ Hide advanced options' : '▼ Advanced options (native DOGE)'}
        </button>

        {/* Advanced Panel */}
        {showAdvanced && (
          <div className="mt-3 rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-4">
            <p className="mb-3 text-xs text-yellow-400/90">
              ⚠️ <strong>Native DOGE scanning</strong> fetches blocks one-by-one via RPC.
              It&apos;s significantly slower than ERC20 log scanning. 100 blocks ≈ 20s.
              Use small ranges only.
            </p>
            <div className="flex gap-2">
              {(['native', 'all'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={status === 'exporting'}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    mode === m
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  } disabled:opacity-50`}
                >
                  {m === 'native' ? 'Native DOGE Only' : 'All (ERC20 + DOGE)'}
                </button>
              ))}
            </div>
            {mode === 'token' && (
              <p className="mt-2 text-xs text-gray-500">
                Currently in default mode (ERC20 tokens). Select an option above to enable native DOGE.
              </p>
            )}
          </div>
        )}
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
                {isAdvanced
                  ? 'Scanning blocks one-by-one via RPC. This may take several minutes.'
                  : 'Fetching ERC20 transfer logs via RPC. This may take a moment.'}
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
          </li>
          <li>
            🪙{' '}
            <strong className="text-gray-300">ERC20 Tokens:</strong> Uses
            eth_getLogs to efficiently find Transfer events indexed by
            your wallet. Fast — scans 100K blocks in ~1 second.
          </li>
          <li>
            📄{' '}
            <strong className="text-gray-300">CSV Columns:</strong> Tx Hash,
            Block, Timestamp, Type (Send/Receive), From, To, Token Symbol,
            Amount, Gas, Status.
          </li>
          <li>
            ⚠️{' '}
            <strong className="text-gray-300">Dogechain Shutdown:</strong>{' '}
            Dogechain is shutting down ~August 7, 2026. Export your data before then!
          </li>
        </ul>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-gray-600">
        <p>
          Free &amp; Open Source • MIT License •{' '}
          <a
            href="https://github.com/DBOT-DC/dogechain-exporter"
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

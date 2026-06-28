# 🐕 Dogechain Data Exporter

Free, open-source tool to export your Dogechain wallet transaction history to CSV. No API keys required.

> ⚠️ **Dogechain is shutting down ~August 7, 2026. Export your data before then!**

## Features

- **ERC20 Token Transfers** — Fetches via `eth_getLogs` for fast, scalable token transfer history
- **Native DOGE Transfers** — Scans blocks to find wallet's native transactions
- **CSV Export** — Download complete transaction history with timestamps, values, gas, addresses
- **No API Key Required** — Uses public Dogechain RPC endpoints with automatic failover
- **Free & Open Source** — MIT License

## How It Works

### Data Sources

| Source | Method | Speed | Notes |
|--------|--------|-------|-------|
| Token Transfers | `eth_getLogs` | Fast | Address-indexed, scans all blocks efficiently |
| Native DOGE | `eth_getBlockByNumber` | Slow | Block-by-block scanning, limit range for speed |

**Note:** The Blockscout explorer API (`explorer.dogechain.dog/api`) is currently unavailable, so this tool uses direct RPC access.

### RPC Endpoints (automatic failover)

1. `dogechain.rpc.thirdweb.com`
2. `rpc.dogechain.dog`
3. `rpc.ankr.com/dogechain`

## Deploy

Deploy to Vercel in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/pennybags/dogechain-exporter)

### Manual Setup

```bash
git clone https://github.com/pennybags/dogechain-exporter.git
cd dogechain-exporter
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Enter your wallet address (0x...)
2. Select export type: ERC20 tokens, native DOGE, or both
3. Optionally specify a token contract address
4. Choose max blocks to scan (lower = faster for native DOGE)
5. Click **Export to CSV**

## CSV Columns

| Column | Description |
|--------|-------------|
| Tx Hash | Transaction hash |
| Block Number | Block containing the transaction |
| Timestamp (UTC) | Block timestamp |
| Type | Send / Receive / Self / Contract Creation |
| From | Sender address |
| To | Receiver address |
| Value | Native token value |
| Token Address | ERC20 token contract address |
| Token Symbol | Token symbol (if known) |
| Token Amount | Token transfer amount |
| Gas Used | Gas consumed |
| Gas Price (Gwei) | Gas price |
| Status | Success / Failed |

## Tech Stack

- **Next.js 15** (App Router, API Routes)
- **TypeScript**
- **Tailwind CSS 4**
- **Node.js RPC** (eth_getLogs, eth_getBlockByNumber)
- **Jest** (unit tests)

## Limitations

- **Native DOGE scanning is slow** — Each block must be fetched individually. Limit your block range.
- **No token symbol resolution** — Requires an additional ERC20 `symbol()` call per token, which is skipped for performance.
- **Blockscout API unavailable** — The explorer's API returns 400 errors. RPC-only mode is used.
- **Rate limited** — 200ms between RPC calls to avoid throttling.

## License

MIT

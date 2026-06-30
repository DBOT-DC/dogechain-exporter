# 🐕 Dogechain Data Exporter

Free, open-source tool to export your Dogechain wallet transaction history to CSV. No API keys required.

> ⚠️ **Dogechain is shutting down ~August 7, 2026. Export your data before then!**

**Live:** [dogechain-exporter.vercel.app](https://dogechain-exporter.vercel.app)

## Features

- **Complete History** — Every transaction from genesis to current block, fetched via the Blockscout Explorer API
- **Token Transfers** — ERC-20 token sends, receives, and approvals with full metadata (symbol, decimals)
- **Single Click** — Paste your address, hit Full Export. No settings, no ranges, no options to configure
- **Real-time Progress** — Live page count and record count as your history is fetched
- **Clean CSV** — 13 columns, ready for Excel, Google Sheets, or any spreadsheet app
- **No API Key Required** — Uses the public Dogechain Blockscout Explorer API
- **Free & Open Source** — MIT License

## How It Works

Queries the [Dogechain Blockscout Explorer API](https://explorer.dogechain.dog/api) using two endpoints:

| Endpoint | What it fetches | API Action |
|----------|----------------|------------|
| Regular Transactions | Native DOGE transfers, contract calls, approvals | `account/txlist` |
| Token Transfers | ERC-20 token sends/receives with symbol & decimals | `account/tokentx` |

Both are fetched with `sort=asc` (oldest first), paginated at 100 records per page, with 300ms delay between pages to avoid rate limiting. Results are merged — token transactions overwrite regular ones for the same hash (they carry richer metadata), then sorted newest-first.

**Typical export time:**
- Normal wallets (<1,000 txs): ~30–60 seconds
- Heavy wallets (100K+ txs): ~10–15 minutes

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/DBOT-DC/dogechain-exporter)

### Manual Setup

```bash
git clone https://github.com/DBOT-DC/dogechain-exporter.git
cd dogechain-exporter
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Paste your wallet address (0x...)
2. Click **Full Export**
3. Wait for the progress bar to complete
4. Download the CSV

That's it. No options to configure — it fetches everything.

## CSV Columns

| Column | Description |
|--------|-------------|
| Tx Hash | Transaction hash |
| Block Number | Block containing the transaction |
| Timestamp (UTC) | Block timestamp |
| Type | Send / Receive / Self / Contract Call |
| From | Sender address |
| To | Receiver address |
| Value | Native DOGE value |
| Token Address | ERC20 token contract address |
| Token Symbol | Token symbol (e.g. OMNOM, USDC) |
| Token Amount | Token transfer amount (human-readable) |
| Gas (Limit) | Gas limit |
| Gas Price (Gwei) | Gas price |
| Status | Success / Failed |

## Tech Stack

- **Next.js 15** (App Router, API Routes)
- **TypeScript**
- **Tailwind CSS 4**
- **Blockscout Explorer API** (Etherscan-compatible `account/txlist` + `account/tokentx`)

## Notes

- The Blockscout Explorer API covers the entire chain history — no block ranges needed
- Rate limit: 300ms between API page requests
- Max 100 records per API page (Blockscout limit)
- The `config.ts` and `rpc.ts` files contain leftover RPC infrastructure from an earlier version. The current exporter uses only the Blockscout HTTP API

## License

MIT

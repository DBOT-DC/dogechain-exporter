import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dogechain Data Exporter | Export Wallet Data to CSV',
  description:
    'Free, open-source tool to export your Dogechain wallet transaction history to CSV. Works with ERC20 tokens and native DOGE transfers.',
  keywords: ['dogechain', 'exporter', 'csv', 'wallet', 'blockchain', 'data'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dogechain Data Exporter | Export Wallet Data to CSV',
  description:
    'Free, open-source tool to export your Dogechain ERC20 token transfers to CSV before the network shuts down ~Aug 7, 2026.',
  keywords: ['dogechain', 'exporter', 'csv', 'wallet', 'erc20', 'blockchain'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body className="bg-mesh min-h-screen font-sans text-gray-200 selection:bg-amber-500/30">
        <div className="relative">
          {/* Ambient glow orbs */}
          <div className="glow-orb -top-32 -left-32 h-96 w-96 bg-amber-500/20" />
          <div className="glow-orb -right-32 top-1/3 h-80 w-80 bg-orange-500/15" />
          <div className="glow-orb bottom-0 left-1/3 h-64 w-64 bg-red-500/10" />
          {children}
        </div>
      </body>
    </html>
  );
}

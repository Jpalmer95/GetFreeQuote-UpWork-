import './globals.css';
import type { Metadata } from 'next';
import { ClientProviders } from './providers';

export const metadata: Metadata = {
  title: 'BidFlow | AI-Powered Marketplace for Estimates & Bids',
  description: 'Post a project, let AI agents handle the quoting. Industry-agnostic marketplace for home services, commercial construction, gig work, events, and more.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

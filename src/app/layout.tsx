import './globals.css';
import type { Metadata } from 'next';
import { ClientProviders } from './providers';

export const metadata: Metadata = {
  title: 'BidFlow | AI-Powered Marketplace for Estimates & Bids',
  description: 'Post a project, let AI agents handle the quoting. Industry-agnostic marketplace for home services, commercial construction, gig work, events, and more.',
};

const hydrationErrorFilter = `
(function() {
  function isHydrationError(msg) {
    if (!msg) return false;
    return msg.indexOf('Hydration failed') !== -1 ||
      msg.indexOf('There was an error while hydrating') !== -1 ||
      msg.indexOf('Text content does not match') !== -1 ||
      msg.indexOf('did not match') !== -1;
  }
  var origReportError = window.reportError;
  if (origReportError) {
    window.reportError = function(e) {
      var msg = e && (e.message || String(e));
      if (isHydrationError(msg)) return;
      return origReportError.call(window, e);
    };
  }
  window.addEventListener('error', function(e) {
    if (isHydrationError(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return true;
    }
  }, true);
  var origConsoleError = console.error;
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    var msg = args.length > 0 ? String(args[0]) : '';
    if (isHydrationError(msg)) return;
    return origConsoleError.apply(console, args);
  };
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: hydrationErrorFilter }} />
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

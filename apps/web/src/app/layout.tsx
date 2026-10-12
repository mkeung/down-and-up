import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = {
  title: 'Down & Up',
  description: 'A place for your daily values, notes, and recordings.',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="Down & Up home">
            <span className="brand-mark" aria-hidden="true">
              ↕
            </span>
            Down & Up
          </Link>
          <Link href="/privacy" className="quiet-link">
            Privacy
          </Link>
        </header>
        {children}
        <footer className="site-footer">
          <span>One day at a time.</span>
          <span>Down & Up</span>
        </footer>
      </body>
    </html>
  );
}

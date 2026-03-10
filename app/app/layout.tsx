import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import HealthIndicator from './components/HealthIndicator';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'AAAC Video Generator',
  description: 'Local SEO video generation dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased bg-slate-50 min-h-screen`}>
        <header className="bg-slate-800 shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                AAAC Video Generator
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Local SEO Campaign Dashboard</p>
            </div>
            <HealthIndicator />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}

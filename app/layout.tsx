import type { Metadata, Viewport } from 'next';
import { Sora } from 'next/font/google';
import './globals.css';

const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '600', '700'], variable: '--font-sora' });

export const metadata: Metadata = {
  title: 'Trip Checker | APIVerve Template',
  description: 'Check whether your passport needs a visa, and whether it is valid long enough for the trip. An APIVerve template.'
};

export const viewport: Viewport = { themeColor: '#0f1b3d' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body>{children}</body>
    </html>
  );
}

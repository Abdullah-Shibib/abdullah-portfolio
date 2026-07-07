import type { Metadata } from 'next';
import { Inter, Orbitron, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const display = Orbitron({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--font-display',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Abdullah Shibib — Command Center',
  description:
    'Interactive 3D portfolio of Abdullah Shibib: Data Engineer, Software Engineer, AI Developer.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="bg-void font-sans text-slate-200 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Geist, Radio_Canada_Big, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
});

const radioCanadaBig = Radio_Canada_Big({
  variable: '--font-radio-canada-big',
  subsets: ['latin'],
});

const title = 'Jinion - A coding agent for your terminal';
const description = 'Jinion is a coding agent for your terminal. It reads your project, changes the code and checks its work, while you steer.';

export const metadata: Metadata = {
  metadataBase: new URL('https://jinion.co'),
  title,
  description,
  openGraph: { title, description, url: '/', siteName: 'Jinion', type: 'website' },
  twitter: { card: 'summary', title, description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${sourceSerif.variable} ${radioCanadaBig.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CopyCraft Studio',
  description: 'AI-Guided Writing and Visual Storytelling Coach',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased selection:bg-neutral-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}


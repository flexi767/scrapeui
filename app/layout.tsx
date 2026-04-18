import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: 'Dealer Listings Tracker',
  description: 'Track dealer car listings',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#111827] text-gray-100 antialiased">
        {children}
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}

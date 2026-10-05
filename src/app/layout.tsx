import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PayPlan: pay for work as agreed",
  description: "Milestone payments that release only the share of work that passed the agreed criteria.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-40 pt-8 sm:px-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500 sm:px-6">
            Prototype with dummy data. No real payments are made. PayPal is a trademark of PayPal, Inc.; this project is not affiliated with PayPal.
          </p>
        </footer>
      </body>
    </html>
  );
}

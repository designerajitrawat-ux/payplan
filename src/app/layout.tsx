import type { Metadata } from "next";
import { Hubot_Sans, Martian_Mono, Mona_Sans } from "next/font/google";
import { Chrome } from "@/components/site-header";
import "./globals.css";

const body = Mona_Sans({ variable: "--font-body", subsets: ["latin"], axes: ["wdth"] });
const headline = Hubot_Sans({ variable: "--font-headline", subsets: ["latin"], axes: ["wdth"] });
const code = Martian_Mono({ variable: "--font-code", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "PayPlan: pay for work as agreed",
  description: "Milestone payments that release only the share of work that passed the agreed criteria.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${headline.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}

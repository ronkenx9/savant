import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SAVANT — Own an AI that got smarter",
  description:
    "Train an AI agent through use. Its learned state is an INFT on 0G you can sell. The buyer inherits a smarter agent, not a blank one.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-canvas text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

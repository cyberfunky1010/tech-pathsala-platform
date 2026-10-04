import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tech Pathsala | Learn with confidence",
  description: "A simple, focused technology learning platform for every school.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

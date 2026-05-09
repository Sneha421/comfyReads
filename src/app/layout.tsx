import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Nav from "../../components/Nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
  style: ["normal"],
  display: "swap",
});

const playfairDisplayItalic = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display-italic",
  weight: "700",
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ComfyReads",
  description: "Books have vibes. Finally, an app that gets it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfairDisplay.variable} ${playfairDisplayItalic.variable}`}
    >
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}

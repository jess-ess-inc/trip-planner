import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Karla, Young_Serif } from "next/font/google";
import "./globals.css";

const display = Young_Serif({ weight: "400", subsets: ["latin"], variable: "--ff-display" });
const body = Karla({ subsets: ["latin"], style: ["normal", "italic"], variable: "--ff-body" });
const data = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--ff-data" });

export const metadata: Metadata = {
  title: "Trip Planner",
  description: "Curated guides and a shared day-by-day plan for any trip.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );
}

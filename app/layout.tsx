import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "CoFuture – Zusammenarbeit neu denken. Mit KI.",
  description:
    "CoFuture hilft Teams, Entscheidungen gemeinsam und asynchron zu treffen. AsyncMeet sammelt Perspektiven per Sprache oder Text und fasst sie nachvollziehbar zusammen.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${manrope.variable} ${sourceSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "next-themes";
import { Archivo, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/lib/brand-colors";

const defaultUrl =
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000/";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "PoliTo Rocket Team",
  description:
    "The rocket engineering student team of Politecnico di Torino. Born for space, built in Torino.",
};

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800", "900"],
});

// Archivo's own "&" is a narrow, old-style shape that reads as another font
// (issue #363). This face carries Inter Tight's "&" alone (a Google Fonts
// `text=&` subset of the variable font, weights 400 to 900, SIL Open Font
// License) and claims only U+0026, so it sits first in the display stack and
// every other glyph falls through to Archivo at the same weight.
const ampersand = localFont({
  src: "./fonts/inter-tight-ampersand.woff2",
  variable: "--font-ampersand",
  weight: "400 900",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0026" }],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Background on <html>, not just <body>: on reload the browser paints the
    // root before the stylesheet lands, and its default is white. That white
    // shows through every transparent canvas for a frame. The colour is the
    // `ground` token, read from the module tailwind.config.ts builds it from.
    <html lang="en" suppressHydrationWarning style={{ background: brand.ground, colorScheme: "dark" }}>
      <body className={`${ampersand.variable} ${archivo.variable} ${geistMono.variable} bg-ground text-prt-text font-display antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster
            richColors
            position="bottom-center"
            closeButton={false}
            toastOptions={{
              style: {
                marginBottom: "3rem",
              },
            }}
          />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

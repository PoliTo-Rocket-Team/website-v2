import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "next-themes";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${archivo.variable} ${geistMono.variable} bg-ground text-prt-text font-display antialiased`}>
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

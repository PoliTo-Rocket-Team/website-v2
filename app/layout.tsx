import { ThemeSwitcher } from "@/components/theme-switcher";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import MaxWidthWrapper from "@/components/max-width-wrapper";
import AuthButton from "@/components/header-auth";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { Toaster } from "@/components/ui/sonner";

const defaultUrl = process?.env?.AUTH_URL ?? "http://localhost:3000/";

//! todo metadata update
export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Next.js and Supabase Starter Kit",
  description: "The fastest way to build apps with Next.js and Supabase",
};

const plusJakartaSans = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html
      lang="en"
      className={plusJakartaSans.className}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground">
        <SessionProvider session={session}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <main>
              {/* //! todo nav component needed here */}
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16 items-center mb-5">
                <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-5 items-center font-bold">
                    {/* //! todo add logo here and link to home page */}
                    <Link href={"/"}>PRT</Link>
                  </div>
                  <div className="flex items-center">
                    <Link href={"/apply"} className="mr-4 ">
                      Apply
                    </Link>
                  </div>
                  <AuthButton />
                </div>
                <ThemeSwitcher />
              </nav>

              <MaxWidthWrapper>{children}</MaxWidthWrapper>
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

              {/* footer component needed here */}
              <footer className="w-full flex mt-10 items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
                <p>Footer and Copyright text here</p>
              </footer>
            </main>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/lib/theme"
import { AuthProvider } from "@/lib/auth"
import { Toaster } from "@/components/ui/toaster"
import LocalGameProvider from "@/components/local-game-provider"

// Optimize font loading
const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: "Cine-Tac-Toe",
  description: "A cinema-themed twist on the classic tic-tac-toe game",
  generator: 'v0.dev',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://cine-tac-toe.example.com'),
  openGraph: {
    title: "Cine-Tac-Toe",
    description: "A cinema-themed twist on the classic tic-tac-toe game",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Cine-Tac-Toe",
    description: "A cinema-themed twist on the classic tic-tac-toe game",
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="transition-colors duration-300">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link rel="preconnect" href="https://chctgzvwqyjoeuyvqkqw.supabase.co" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#f5f9ff" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/clapperboard.png" type="image/png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <LocalGameProvider>
              <main className="min-h-screen">
                {children}
              </main>
              <Toaster />
            </LocalGameProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
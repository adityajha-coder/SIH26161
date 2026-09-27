import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Poppins, JetBrains_Mono } from 'next/font/google'
import { AppShell } from '@/components/shell/app-shell'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Jalrekha · Dam Break & River Inundation Intelligence',
  description:
    'Coupled hydrodynamic dam break and river blockage inundation modelling platform with satellite Earth observation integration — Tehri Dam & Bhagirathi River reach.',
  icons: {
    icon: '/jalrekha-logo.png',
    apple: '/jalrekha-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0e1017',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${poppins.variable} ${jetbrains.variable} h-full overflow-hidden`} suppressHydrationWarning>
      <body className={`antialiased font-sans bg-background text-foreground h-full w-full overflow-hidden ${poppins.className}`} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
        <Toaster theme="dark" position="bottom-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

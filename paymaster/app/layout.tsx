import './globals.css'

export const metadata = {
  title: 'Paymaster Demo',
  description: 'USDC Paymaster demonstration using EIP-7702',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reputation Recovery Simulator",
  description: "PR / reputation management agency simulation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 24, maxWidth: 720 }}>
        {children}
      </body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Verrington Order App",
  description: "Firewood ordering",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "PAC-CONTRIBUTIONS Backend",
  description: "Backend infrastructure for GitHub contribution ingestion.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

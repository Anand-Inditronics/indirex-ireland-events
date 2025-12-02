// app/layout.tsx
import "./globals.css";
import AppLayout from "@/components/ui/app-layout-sidebar";
import { Providers } from "./providers";


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}

import "./globals.css";
import { SidebarProvider } from "./components/SidebarContext";
import Sidebar from "./components/Sidebar";

export const metadata = {
  title: "ADIM OWAR JARPA OPERA - Online Ticket System",
  description:
    "Book your ADIM OWAR JARPA OPERA stadium entry ticket online. ADIM OWAR JARPA OPERA 2026 - Bahanada, Khunta, Mayurbhanj.",
};

export default function RootLayout({ children }) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="en">
      <head>
        {isDev && (
          <>
            <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate, proxy-revalidate" />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
          </>
        )}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SidebarProvider>
          <Sidebar />
          {children}
        </SidebarProvider>
      </body>
    </html>
  );
}

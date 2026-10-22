import "./globals.css";
import StageContactFab from "./components/StageContactFab";
import CustomerVisitTracker from "./components/CustomerVisitTracker";

export const metadata = {
  title: "JATRA BAZAAR - Live Show Ticket Booking",
  description:
    "Book live Jatra show tickets online. Fast, secure, and hassle-free ticketing for JATRA BAZAAR.",
  applicationName: "JATRA BAZAAR",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JATRA BAZAAR",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <head>
        {isDev && (
          <>
            <meta
              httpEquiv="Cache-Control"
              content="no-store, no-cache, must-revalidate, proxy-revalidate"
            />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
          </>
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    if (regs && regs.length > 0) {
                      Promise.all(regs.map(function(r) { return r.unregister(); })).then(function() {
                        if ('caches' in window) {
                          caches.keys().then(function(keys) {
                            Promise.all(keys.map(function(k) { return caches.delete(k); })).then(function() {
                              window.location.reload();
                            });
                          });
                        } else {
                          window.location.reload();
                        }
                      });
                    }
                  });
                }
              })();
            `,
          }}
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="JATRA BAZAAR" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
        <CustomerVisitTracker />
        {children}
        <StageContactFab />
      </body>
    </html>
  );
}

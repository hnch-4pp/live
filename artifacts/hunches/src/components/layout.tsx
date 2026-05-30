import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { TopNotificationBanner } from "./top-notification-banner";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNotificationBanner />
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}

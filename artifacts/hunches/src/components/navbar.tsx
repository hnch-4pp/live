import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <div className="w-3 h-3 bg-background rounded-full" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">Hunches</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link href="/?category=sports" className="hover:text-primary transition-colors">Sports</Link>
            <Link href="/?category=crypto" className="hover:text-primary transition-colors">Crypto</Link>
            <Link href="/?category=politics" className="hover:text-primary transition-colors">Politics</Link>
            <Link href="/?category=entertainment" className="hover:text-primary transition-colors">Entertainment</Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Log in
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full px-5">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

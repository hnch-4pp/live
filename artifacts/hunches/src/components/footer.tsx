import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto py-12 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center opacity-80">
                <div className="w-2 h-2 bg-background rounded-full" />
              </div>
              <span className="font-display font-bold text-lg text-foreground">Hunches</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
              No money wagered. No house edge. Just your prediction against the community. Win real rewards by making the right call on real-world events.
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-foreground">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-primary transition-colors">Terms & Conditions</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-foreground">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/responsible" className="hover:text-primary transition-colors">Responsible Play</Link></li>
              <li><a href="#" className="hover:text-primary transition-colors">How it Works</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Support</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-border/50 text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} Hunches Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/60">Skill-based prediction platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

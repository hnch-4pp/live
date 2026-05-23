import { Layout } from "@/components/layout";

export default function Responsible() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="prose prose-invert prose-primary mx-auto">
          <h1 className="font-display text-primary">Responsible Play</h1>
          
          <p className="text-xl font-medium text-foreground mb-8">
            While Hunch involves no real money wagering, we believe in promoting a healthy approach to prediction competitions.
          </p>
          
          <div className="bg-card border border-border p-6 rounded-lg mb-8">
            <h3 className="text-foreground mt-0">Our Stance on Gambling</h3>
            <p className="mb-0 text-muted-foreground">
              Hunch is definitively not a gambling platform. You cannot deposit funds, you cannot lose money, and there is no house edge. Prizes are funded through sponsorships and platform revenue, not user losses.
            </p>
          </div>
          
          <h2>Healthy Habits</h2>
          <p>Even in a free-to-play environment, excessive screen time or obsessive monitoring of results can be detrimental. We encourage all users to:</p>
          <ul>
            <li>Set time limits for browsing the platform</li>
            <li>Remember that predictions are for entertainment</li>
            <li>Not let platform activity interfere with daily responsibilities</li>
            <li>Take regular breaks</li>
          </ul>
          
          <h2>Taking a Break</h2>
          <p>If you feel you are spending too much time on Hunch, you can request a temporary or permanent account deactivation. Contact our support team to initiate a self-exclusion period.</p>
        </div>
      </div>
    </Layout>
  );
}

import { Layout } from "@/components/layout";

export default function Terms() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="prose prose-invert prose-primary mx-auto">
          <h1 className="font-display">Terms & Conditions</h1>
          <p className="text-muted-foreground lead">Last updated: October 15, 2023</p>
          
          <h2>1. Introduction</h2>
          <p>Welcome to Hunches. These Terms and Conditions govern your use of our platform. By accessing or using Hunches, you agree to be bound by these terms.</p>
          
          <h2>2. Not a Gambling Platform</h2>
          <p>Hunches is strictly a skill-based prediction platform. <strong>Users do not wager real money</strong> to participate. Prizes are awarded based on skill in predicting real-world outcomes, not chance. There is no house edge and no financial risk to the user.</p>
          
          <h2>3. Eligibility</h2>
          <p>You must be at least 18 years old to participate in Hunches competitions and be eligible to win prizes. Void where prohibited by law.</p>
          
          <h2>4. Prize Distribution</h2>
          <p>Prizes (including gift cards and merchandise) are awarded as stated on individual Hunch pages. In the event of a tie or disputed outcome, Hunches reserves the right to determine the winner based on our internal rules or split the prize value.</p>
          
          <h2>5. Account Rules</h2>
          <p>Users may only maintain one active account. Use of automated scripts, bots, or multiple accounts to submit predictions will result in immediate suspension and forfeiture of any accumulated prizes.</p>
        </div>
      </div>
    </Layout>
  );
}

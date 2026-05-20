import { Layout } from "@/components/layout";

export default function Privacy() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="prose prose-invert prose-primary mx-auto">
          <h1 className="font-display">Privacy Policy</h1>
          <p className="text-muted-foreground lead">Last updated: October 15, 2023</p>
          
          <h2>1. Information We Collect</h2>
          <p>We collect information you provide directly to us when creating an account, making predictions, and communicating with us. This includes your name, email address, and prediction history.</p>
          
          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to operate, maintain, and improve our platform. Specifically, we use your data to:</p>
          <ul>
            <li>Process your predictions and calculate leaderboards</li>
            <li>Distribute prizes to winners</li>
            <li>Communicate with you regarding platform updates</li>
            <li>Prevent fraud and ensure fair competition</li>
          </ul>
          
          <h2>3. Information Sharing</h2>
          <p>We do not sell your personal data to third parties. We may share information with service providers who assist in operating our platform, such as prize fulfillment partners and analytics providers.</p>
          
          <h2>4. Data Security</h2>
          <p>We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction.</p>
        </div>
      </div>
    </Layout>
  );
}

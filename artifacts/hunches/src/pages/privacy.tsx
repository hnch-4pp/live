import { Layout } from "@/components/layout";

export default function Privacy() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="prose prose-invert prose-primary mx-auto">
          <h1 className="font-display">Privacy Policy</h1>
          <p className="text-muted-foreground lead">Last updated: June 14, 2026</p>

          <h2>1. Information We Collect</h2>
          <p>We collect information you provide directly to us when creating an account, making predictions, and communicating with us. This includes your name, email address, date of birth, and prediction history.</p>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to operate, maintain, and improve our platform. Specifically, we use your data to:</p>
          <ul>
            <li>Process your predictions and calculate leaderboards</li>
            <li>Distribute prizes to winners</li>
            <li>Communicate with you regarding platform updates</li>
            <li>Prevent fraud and ensure fair competition</li>
            <li>Understand how users interact with the platform (analytics)</li>
          </ul>

          <h2>3. Cookies and Tracking Technologies</h2>
          <p>We use the following types of cookies and storage on your device:</p>
          <ul>
            <li><strong>Session cookie</strong> — Strictly necessary. Keeps you logged in while you navigate the platform. Set by our server via <code>express-session</code>. Expires when you close your browser or log out.</li>
            <li><strong>Affiliate and referral cookies</strong> — Functional. Used to attribute referrals and referral discounts to the correct user. Stored for up to 30 days.</li>
            <li><strong>UI preference storage</strong> — Functional. Saves minor interface preferences (e.g. sidebar state) in your browser's local storage.</li>
            <li><strong>Google Analytics (via Google Tag Manager)</strong> — Analytics. We use Google Tag Manager (container ID: GTM-5KNZC4SB) to load Google Analytics, which collects anonymised usage data such as pages visited, session duration, and device type. This service is provided by Google LLC and sets cookies including <code>_ga</code> and <code>_gid</code>. Google Analytics is only activated after you give your consent. For more information see <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.</li>
          </ul>
          <p>You can accept or decline analytics cookies at any time using the banner shown on your first visit. Declining will not affect your ability to use the platform. Strictly necessary cookies cannot be disabled as the platform cannot function without them.</p>

          <h2>4. Information Sharing</h2>
          <p>We do not sell your personal data to third parties. We may share information with service providers who assist in operating our platform, such as:</p>
          <ul>
            <li>Prize fulfilment partners (to deliver prizes to winners)</li>
            <li>Google LLC (Google Analytics — only if you have consented)</li>
            <li>Stripe, Inc. (payment processing)</li>
            <li>Twilio Inc. and Resend (communications)</li>
          </ul>

          <h2>5. Data Security</h2>
          <p>We implement appropriate technical and organisational security measures to protect your information against unauthorised access, alteration, disclosure, or destruction.</p>

          <h2>6. Your Rights</h2>
          <p>Depending on your jurisdiction you may have the right to access, correct, delete, or object to the processing of your personal data. To exercise any of these rights please contact us.</p>

          <h2>7. Contact</h2>
          <p>For any privacy-related questions please contact us at <a href="mailto:hola@hunch.fan">hola@hunch.fan</a>.</p>
        </div>
      </div>
    </Layout>
  );
}

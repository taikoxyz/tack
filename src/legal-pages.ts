const PROD_URL = process.env.LANDING_URL ?? 'https://tack.inferenceroom.ai';

function legalPageHtml(title: string, body: string): string {
  const home = PROD_URL;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Tack</title>
  <meta name="description" content="${title} for Tack." />
  <meta name="theme-color" content="#05070d" />
  <link rel="icon" href="/favicon.svg?v=tack-wordmark-20260428" type="image/svg+xml" />
  <style>
    :root {
      --bg: #05070d;
      --panel: #0f1320;
      --text: #f1f3f9;
      --muted: #b4bccd;
      --border: rgba(255,255,255,0.09);
      --accent: #e81899;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.65;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 28px 20px 56px;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 14px;
    }
    .brand {
      color: var(--text);
      text-decoration: none;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .brand .slash { color: var(--accent); }
    .back {
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
    }
    .back:hover { color: var(--text); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 22px;
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: clamp(1.8rem, 5vw, 2.2rem);
      line-height: 1.15;
    }
    h2 {
      margin: 24px 0 8px;
      font-size: 1.15rem;
    }
    p, li { color: var(--muted); }
    p { margin: 10px 0; }
    ul { margin: 10px 0 10px 18px; }
    strong { color: var(--text); }
    .stamp {
      margin-top: 18px;
      font-size: 13px;
      color: var(--muted);
    }
    a { color: #ffa1d6; }
  </style>
</head>
<body>
  <main class="container">
    <div class="top">
      <a class="brand" href="${home}" aria-label="Tack home"><span class="slash">/</span>tack</a>
      <a class="back" href="${home}">Back to home</a>
    </div>
    <article class="panel">
      ${body}
    </article>
  </main>
</body>
</html>`;
}

export function termsOfServiceHtml(): string {
  return legalPageHtml('Terms of Service', `<h1>Terms of Service</h1>
<p>By accessing or using Tack, you agree to these Terms of Service.</p>
<h2>1. Service Scope</h2>
<p>Tack provides software-based IPFS pinning and retrieval interfaces. We may update, improve, or discontinue features at any time.</p>
<h2>2. Payments and Pricing</h2>
<p>Paid endpoints require a valid payment method supported by the service and its payment providers. Pricing is usage-based and may change over time. Current rates are published through service metadata and APIs.</p>
<h2>3. Acceptable Use</h2>
<ul>
  <li>You must not use Tack for unlawful, fraudulent, deceptive, harmful, or abusive activity.</li>
  <li>You are responsible for rights and permissions for all content you upload or pin.</li>
  <li>You must not attempt to disrupt service availability or security.</li>
  <li>You must not use Tack to sell or deliver prohibited categories through a payment processor, including physical goods, unrelated human services, regulated financial services, gambling, adult content, or products that enable unauthorized access, IP infringement, or impersonation/deepfake abuse.</li>
  <li>You must not use Tack as a marketplace or payment intermediary for third-party sellers.</li>
  <li>You must comply with applicable card-network, payment-processor, and data-protection requirements (including consent requirements where applicable).</li>
</ul>
<h2>4. Data and Availability</h2>
<p>Tack is provided on an “as is” and “as available” basis. We do not guarantee uninterrupted availability, durability, or replication beyond the described service behavior.</p>
<h2>5. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, Tack and its operators are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service.</p>
<h2>6. Termination</h2>
<p>We may suspend or terminate access for behavior that violates these terms or creates risk to the platform.</p>
<h2>7. Changes</h2>
<p>We may revise these terms. Continued use after updates means you accept the revised terms.</p>
<p class="stamp"><strong>Last updated:</strong> 2026-05-06</p>`);
}

export function privacyPolicyHtml(): string {
  return legalPageHtml('Privacy Policy', `<h1>Privacy Policy</h1>
<p>This Privacy Policy explains what information Tack processes when you use the service.</p>
<h2>1. Information We Process</h2>
<ul>
  <li><strong>Request metadata:</strong> timestamps, request IDs, endpoint paths, and response status.</li>
  <li><strong>Wallet and payment metadata:</strong> payment-related wallet identifiers and payment protocol metadata.</li>
  <li><strong>Pinned content metadata:</strong> CID, pin request IDs, and associated pin attributes.</li>
</ul>
<h2>2. How We Use Information</h2>
<ul>
  <li>Operate and secure the service.</li>
  <li>Process payments and provide authenticated access to owner endpoints.</li>
  <li>Measure reliability, usage, and abuse signals.</li>
</ul>
<h2>3. Retention</h2>
<p>We retain operational and billing-related records for as long as needed for service operation, legal compliance, and dispute resolution.</p>
<h2>4. Sharing</h2>
<p>We may share data with infrastructure and payment providers strictly to run the service. We do not sell personal information.</p>
<h2>5. Security</h2>
<p>We use reasonable technical and organizational safeguards, but no system can be guaranteed fully secure.</p>
<h2>6. Your Responsibilities</h2>
<p>Do not submit sensitive or regulated personal data unless you have a lawful basis and have applied appropriate protections.</p>
<h2>7. Updates</h2>
<p>We may update this policy from time to time. The latest version is always published on this page.</p>
<p class="stamp"><strong>Last updated:</strong> 2026-05-06</p>`);
}

export function refundPolicyHtml(): string {
  return legalPageHtml('Refund Policy', `<h1>Refund Policy</h1>
<p>Tack charges per paid request. This policy explains when refunds may be considered.</p>
<h2>1. General Rule</h2>
<p>Payments are generally non-refundable once successfully settled on-chain or via the supported payment protocol.</p>
<h2>2. Eligible Cases</h2>
<p>Refunds may be considered, at our discretion, when:</p>
<ul>
  <li>a verified duplicate charge occurred for the same operation,</li>
  <li>the service failed to perform the paid action due to a confirmed platform fault, or</li>
  <li>an incorrect charge is clearly attributable to a service-side error.</li>
</ul>
<h2>3. Non-Eligible Cases</h2>
<ul>
  <li>User mistakes (wrong CID, wrong duration, wrong wallet, etc.).</li>
  <li>Content or network conditions outside Tack infrastructure.</li>
  <li>Policy or terms violations leading to access restrictions.</li>
</ul>
<h2>4. Requesting a Refund</h2>
<p>Include the request ID, wallet address, transaction/payment reference, and a short explanation. We may request additional details to verify eligibility.</p>
<h2>5. Decision and Processing</h2>
<p>If approved, refunds are sent via a method we determine appropriate for the original payment flow, subject to processor, network, and legal constraints. Processing time can vary by network and provider.</p>
<p class="stamp"><strong>Last updated:</strong> 2026-05-06</p>`);
}

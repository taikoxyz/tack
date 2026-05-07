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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,400..700,30..100;1,9..144,400..700,30..100&family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
  <link rel="icon" href="/favicon.svg?v=tack-wordmark-20260428" type="image/svg+xml" />
  <style>
    :root {
      --ink-950: #04060c;
      --ink-900: #0a0d17;
      --ink-850: #0e1220;
      --ink-700: #1d2333;
      --ink-600: #2d3449;
      --ink-400: #656e88;
      --ink-300: #8d95ad;
      --ink-200: #b4bccd;
      --ink-100: #dce0eb;
      --ink-50: #f1f3f9;
      --pink-200: #ffa1d6;
      --pink-300: #e81899;
      --pink-100: #ffd9ee;
      --f-body: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --f-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      --f-display: 'Fraunces', ui-serif, 'Iowan Old Style', 'Apple Garamond', Georgia, serif;
      --bg: var(--ink-950);
      --panel: #0e1220;
      --panel: color-mix(in oklab, var(--ink-850) 92%, black);
      --text: var(--ink-50);
      --muted: var(--ink-200);
      --border: rgba(101, 110, 136, 0.4);
      --border: color-mix(in oklab, var(--ink-600) 45%, transparent);
      --accent: var(--pink-300);
    }
    * { box-sizing: border-box; }
    ::selection { background: var(--pink-300); color: white; }
    body {
      margin: 0;
      font-family: var(--f-body);
      background: var(--bg);
      color: var(--ink-100);
      line-height: 1.55;
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
      font-family: var(--f-mono);
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .brand .slash { color: var(--accent); }
    .back {
      color: var(--ink-300);
      text-decoration: none;
      font-size: 14px;
      font-family: var(--f-mono);
    }
    .back:hover { color: var(--text); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 22px 22px 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
    }
    h1 {
      margin: 0 0 8px 0;
      font-family: var(--f-display);
      font-size: clamp(2.2rem, 5.2vw, 4rem);
      line-height: 1.0;
      font-variation-settings: 'wght' 520, 'SOFT' 70;
      color: var(--ink-50);
    }
    h2 {
      margin: 24px 0 8px;
      font-family: var(--f-display);
      font-size: clamp(1.4rem, 2.8vw, 2rem);
      line-height: 1.15;
      font-variation-settings: 'wght' 500, 'SOFT' 65;
      color: var(--ink-50);
    }
    h3 {
      margin: 18px 0 8px;
      font-size: 1rem;
      color: var(--text);
    }
    p, li {
      color: var(--muted);
      font-size: clamp(0.98rem, 1.1vw, 1.04rem);
      line-height: 1.62;
    }
    p { margin: 10px 0; }
    ul { margin: 10px 0 10px 18px; }
    strong { color: var(--text); }
    .lede {
      font-size: clamp(1.05rem, 1.6vw, 1.2rem);
      color: var(--text);
      margin-bottom: 14px;
    }
    .section {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
    }
    .section:first-of-type {
      margin-top: 14px;
      padding-top: 0;
      border-top: 0;
    }
    .note {
      margin-top: 12px;
      font-size: 12.5px;
      color: var(--muted);
      font-family: var(--f-mono);
      line-height: 1.5;
    }
    .callout {
      margin: 14px 0 8px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid rgba(232, 24, 153, 0.35);
      border: 1px solid color-mix(in oklab, var(--pink-300) 40%, transparent);
      background: rgba(232, 24, 153, 0.08);
      background: color-mix(in oklab, var(--pink-300) 12%, transparent);
      color: var(--pink-100);
      font-size: 14px;
    }
    .stamp {
      margin-top: 18px;
      font-size: 12px;
      color: var(--muted);
      font-family: var(--f-mono);
      letter-spacing: 0.01em;
    }
    a { color: var(--pink-200); }
    a:hover { color: var(--ink-50); }
    @media (max-width: 700px) {
      .container { padding: 24px 16px 44px; }
      .panel { padding: 18px 16px 20px; }
      .top { margin-bottom: 14px; padding-bottom: 12px; }
      h2 { margin-top: 20px; }
    }
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
<p class="lede">These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Tack and related interfaces (collectively, the &ldquo;Service&rdquo;). They are provided as boilerplate only and do not constitute legal advice. Replace bracketed placeholders (for example [BUSINESS_ENTITY_NAME]) with your finalized legal details.</p>
<div class="callout"><strong>Important:</strong> You must comply with applicable laws and with card-network and payment-provider rules. Many payment processors publish acceptable-use restrictions (for example, merchant-of-record platforms such as Paddle prohibit certain categories of goods and services). Similar restrictions may apply to your use of paid features.</div>
<section class="section">
<h2>1. Parties and agreement</h2>
<p>The Service is operated by <strong>[BUSINESS_ENTITY_NAME]</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By accessing or using the Service, or by paying for paid features, you agree to these Terms. If you do not agree, do not use the Service.</p>
<p><strong>Effective date:</strong> [EFFECTIVE_DATE]</p>
</section>
<section class="section">
<h2>2. Eligibility</h2>
<p>You represent that you have legal capacity to enter these Terms and that your use of the Service complies with applicable laws. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization.</p>
</section>
<section class="section">
<h2>3. Service description</h2>
<p>Tack provides software-based interfaces for IPFS pinning, retrieval, and related operations. Features, endpoints, pricing signals, and availability may change. Documentation, API responses, and published pricing metadata describe how the Service operates at a given time.</p>
<p>Replication, durability, and geographic distribution are subject to configuration and operational reality. Unless expressly stated otherwise in writing, we do not guarantee specific replication outcomes.</p>
</section>
<section class="section">
<h2>4. Accounts, wallets, and security</h2>
<p>The Service may rely on wallet-based identity, signed requests, and authenticated owner flows. You are solely responsible for safeguarding wallets, keys, credentials, and devices used with the Service.</p>
<ul>
  <li>You must use wallets and signing keys you are authorized to control.</li>
  <li>You must not attempt to bypass authentication, impersonate another party, or obtain access to pins or content you do not own or are not authorized to access.</li>
  <li>You must promptly notify us at <strong>[CONTACT_EMAIL]</strong> if you suspect unauthorized activity related to your wallet or owner access.</li>
</ul>
</section>
<section class="section">
<h2>5. Fees, taxes, and payments</h2>
<p>Certain operations may require payment via supported protocols and networks. Amounts, timing, and settlement mechanics may depend on third-party facilitators, blockchains, and wallets.</p>
<p>You are responsible for any taxes associated with your use of the Service, except where applicable law requires otherwise. You agree to provide accurate information needed for compliance and dispute handling.</p>
<p>Payment processing is subject to network fees, facilitator rules, and rejection or reversal events outside our reasonable control.</p>
</section>
<section class="section">
<h2>6. Acceptable use</h2>
<p>You agree to use the Service only for lawful purposes and in compliance with these Terms and applicable regulations. You must not:</p>
<ul>
  <li>violate any law or regulation, or infringe third-party intellectual property, privacy, or publicity rights;</li>
  <li>upload, pin, retrieve, distribute, or facilitate unlawful, fraudulent, deceptive, abusive, harassing, or discriminatory content or activity;</li>
  <li>attempt to disrupt, degrade, or gain unauthorized access to the Service, other users, or underlying infrastructure;</li>
  <li>use outbound telemarketing or other high-risk marketing channels in connection with offerings delivered through the Service where prohibited by applicable rules;</li>
  <li>process personal data without a lawful basis and appropriate notices where required (including consent where applicable under laws such as the GDPR).</li>
</ul>
</section>
<section class="section">
<h2>7. Prohibited offerings and payment-compliance categories</h2>
<p>To reduce chargeback, fraud, sanctions, and card-network risk, you must not use the Service (including paid flows) in connection with any of the following. This list reflects common merchant-of-record and payment-network restrictions and is illustrative, not exhaustive:</p>
<ul>
  <li><strong>Physical goods or physical delivery.</strong> Products or services whose primary fulfillment requires shipping physical goods or tangible delivery outside the scope of licensed software.</li>
  <li><strong>Non-software services as a primary business.</strong> Human services not integrated with a bona fide software product (for example, standalone consulting, coaching, or &ldquo;expert access&rdquo; without a substantive software deliverable), where such sales are disallowed by your payment path.</li>
  <li><strong>No bona fide product.</strong> Donations, crowdfunding, community access, sponsorship, or similar models where there is no genuine software or digital service sold, if disallowed by your processor.</li>
  <li><strong>Intellectual property abuse.</strong> Offering or enabling piracy, unauthorized redistribution, illicit streaming, circumvention tools, or other infringement of copyrights, trademarks, trade secrets, or license terms.</li>
  <li><strong>Unauthorized access and surveillance.</strong> Spyware, stalkerware, keyloggers, RATs, credential stuffing tools, unlock or bypass services marketed to circumvent security, or similar offerings.</li>
  <li><strong>Marketplaces and intermediation.</strong> Operating as a marketplace or payment intermediary enabling unrelated third parties to sell to end customers through your account, where prohibited.</li>
  <li><strong>High-risk marketing.</strong> Pyramid schemes, multi-level marketing, referral-only compensation structures, mass SMS or messaging blasts, automated engagement manipulation, or deceptive &ldquo;get rich quick&rdquo; schemes.</li>
  <li><strong>Adult or age-restricted sexual content.</strong> Pornography, sexual services, or dating products in this category where restricted.</li>
  <li><strong>Gambling and games of chance.</strong> Betting, wagering, sweepstakes entries sold for cash or material prizes, lotteries, fantasy sports with prizes, or similar offerings where restricted.</li>
  <li><strong>Regulated financial and money services.</strong> Regulated financial products, money transmission, payment facilitation, stored value, unlicensed crypto exchange or trading platforms, investment or credit advice, or other categories treated as high-risk by card networks, where applicable.</li>
  <li><strong>Deceptive or harmful AI and media.</strong> Non-consensual deepfakes, face swap or voice impersonation for fraud, realistic synthetic identities used to deceive, or automated decision-making that violates law or card-network rules.</li>
  <li><strong>Other restricted categories.</strong> Categories commonly restricted or heavily diligence-gated by payment providers (for example travel booking, certain health claims, pseudo-scientific medical claims, government-impersonation services, captcha-solving for abuse, or resale of third-party licenses without authorization), where they apply to your payment path.</li>
</ul>
<p>We may suspend or terminate use that appears likely to violate payment-provider or card-network rules, even if not listed above.</p>
</section>
<section class="section">
<h2>8. Your content and license to operate the Service</h2>
<p>You retain rights in content you provide. You grant us a non-exclusive, worldwide, royalty-free license to host, process, transmit, and display your content only as needed to provide the Service, enforce these Terms, and comply with law.</p>
<p>You represent that you have all rights necessary to upload, pin, or retrieve content through the Service.</p>
</section>
<section class="section">
<h2>9. Intellectual property</h2>
<p>Except for your content, the Service, branding, and documentation are owned by us or our licensors. No rights are granted except as expressly stated in these Terms.</p>
</section>
<section class="section">
<h2>10. Privacy</h2>
<p>Our <a href="/privacy">Privacy Policy</a> explains how we process information. It is incorporated by reference.</p>
</section>
<section class="section">
<h2>11. Availability; changes; suspension</h2>
<p>The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We may modify, limit, or discontinue features; apply rate limits; and perform maintenance.</p>
<p>We may suspend or terminate access if you breach these Terms, create risk to users or payment partners, or if required by law or competent authority.</p>
</section>
<section class="section">
<h2>12. Disclaimer of warranties</h2>
<p>To the fullest extent permitted by law, we disclaim all warranties, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, title, and non-infringement.</p>
</section>
<section class="section">
<h2>13. Limitation of liability</h2>
<p>To the maximum extent permitted by law, we and our affiliates, directors, employees, and suppliers will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill.</p>
<p>Our aggregate liability for claims arising out of or relating to the Service or these Terms will not exceed the greater of (a) the amounts you paid to us for the Service in the three (3) months before the event giving rise to liability, or (b) one hundred U.S. dollars (USD $100), except where law prohibits such a cap.</p>
</section>
<section class="section">
<h2>14. Indemnity</h2>
<p>You will defend, indemnify, and hold harmless [BUSINESS_ENTITY_NAME] and its affiliates from claims, damages, losses, and expenses (including reasonable attorneys&rsquo; fees) arising from your content, your use of the Service, or your breach of these Terms or applicable law.</p>
</section>
<section class="section">
<h2>15. Governing law and venue</h2>
<p>These Terms are governed by the laws of <strong>[GOVERNING_LAW]</strong>, without regard to conflict-of-law rules. You agree that exclusive jurisdiction and venue for disputes will lie in the courts located in <strong>[VENUE]</strong>, subject to applicable mandatory consumer protections.</p>
</section>
<section class="section">
<h2>16. General</h2>
<ul>
  <li><strong>Entire agreement.</strong> These Terms and policies referenced herein are the entire agreement regarding the Service.</li>
  <li><strong>Severability.</strong> If a provision is invalid, the remainder remains in effect.</li>
  <li><strong>Assignment.</strong> You may not assign these Terms without our consent. We may assign in connection with a merger, acquisition, or sale of assets.</li>
  <li><strong>Export and sanctions.</strong> You must comply with export control and sanctions laws.</li>
</ul>
</section>
<section class="section">
<h2>17. Contact and updates</h2>
<p>Questions: <strong>[CONTACT_EMAIL]</strong>. We may update these Terms by posting a new version. Material changes should be reflected by updating the effective date. Continued use after the effective date may constitute acceptance where permitted by law.</p>
</section>
<p class="note">Not legal advice. Have counsel review governing law, venue, liability caps, and payment-processor-specific obligations for your entity and jurisdictions.</p>
<p class="stamp"><strong>Effective:</strong> [EFFECTIVE_DATE] &middot; <strong>Version:</strong> 2026-05-06</p>`);
}

export function privacyPolicyHtml(): string {
  return legalPageHtml('Privacy Policy', `<h1>Privacy Policy</h1>
<p class="lede">This Privacy Policy describes how <strong>[BUSINESS_ENTITY_NAME]</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo;) processes personal data when you use Tack (the &ldquo;Service&rdquo;). This document is boilerplate and not legal advice. Replace bracketed placeholders with your finalized details.</p>
<div class="callout"><strong>Controller:</strong> [BUSINESS_ENTITY_NAME]. <strong>Contact:</strong> [CONTACT_EMAIL]. <strong>Effective:</strong> [EFFECTIVE_DATE]</div>
<section class="section">
<h2>1. Scope</h2>
<p>This policy applies to information we process in connection with the Service, including our websites, APIs, payment-gated flows, and support channels. It does not govern third-party sites or wallets you choose to use.</p>
</section>
<section class="section">
<h2>2. Personal data we collect</h2>
<p>Depending on how you use the Service, we may process:</p>
<ul>
  <li><strong>Identifiers and contact data:</strong> email or other identifiers you provide for support or notices (if collected).</li>
  <li><strong>Wallet and payment-related data:</strong> blockchain addresses, transaction identifiers, payment protocol metadata, and amounts required to validate and record payments.</li>
  <li><strong>Service and request metadata:</strong> timestamps, request IDs, IP addresses, user agent strings, endpoint paths, HTTP status, error codes, and rate-limit signals.</li>
  <li><strong>Account and owner-access data:</strong> tokens or credentials issued for authenticated owner endpoints, and associated wallet identifiers.</li>
  <li><strong>Pinning and content metadata:</strong> CIDs, pin identifiers, sizes, durations, replication status, and similar attributes. We generally do not need to index file contents for billing, but content you upload may be processed as part of storage and retrieval.</li>
  <li><strong>Usage and reliability telemetry:</strong> aggregated counters, operational metrics, and anti-abuse signals.</li>
</ul>
<p>We use cookies or similar technologies only to the extent needed for security and session continuity of our own properties. Analytics practices should be described here if you add them.</p>
</section>
<section class="section">
<h2>3. How we use personal data</h2>
<p>We process personal data to:</p>
<ul>
  <li>provide, operate, secure, and improve the Service;</li>
  <li>authenticate requests and enforce access controls (including owner isolation);</li>
  <li>process and reconcile payments, detect fraud, and meet payment-network and processor obligations;</li>
  <li>communicate about incidents, policy violations, and operational notices;</li>
  <li>comply with legal obligations and respond to lawful requests;</li>
  <li>defend our legal interests and enforce our <a href="/terms">Terms of Service</a>.</li>
</ul>
</section>
<section class="section">
<h2>4. Legal bases (where applicable)</h2>
<p>Where the GDPR or similar laws apply, we rely on one or more of: performance of a contract, legitimate interests (for example security, abuse prevention, and service improvement, balanced against your rights), legal obligation, and consent where required for specific processing.</p>
</section>
<section class="section">
<h2>5. Sharing and subprocessors</h2>
<p>We share personal data with:</p>
<ul>
  <li><strong>Infrastructure providers</strong> that host or operate the Service (for example cloud or bare-metal hosts);</li>
  <li><strong>Payment and blockchain infrastructure</strong> required to settle or verify transactions;</li>
  <li><strong>Professional advisors</strong> when required (for example legal or accounting), subject to confidentiality;</li>
  <li><strong>Authorities</strong> when required by law or to protect rights and safety.</li>
</ul>
<p>We do not sell personal data as that term is commonly defined in U.S. state privacy laws. We do not use personal data for cross-context behavioral advertising unless we disclose and obtain consent where required.</p>
</section>
<section class="section">
<h2>6. International transfers</h2>
<p>Your data may be processed in countries other than your own. Where required, we use appropriate safeguards (for example standard contractual clauses) and can provide additional information on request where legally obligated.</p>
</section>
<section class="section">
<h2>7. Retention</h2>
<p>We retain personal data for as long as necessary to provide the Service, comply with law, resolve disputes, and enforce agreements. Retention criteria include operational need, statutory limitation periods, and fraud-prevention requirements.</p>
</section>
<section class="section">
<h2>8. Security</h2>
<p>We implement reasonable technical and organizational measures appropriate to the risk. No method of transmission or storage is completely secure; you use the Service at your own risk regarding content you upload.</p>
</section>
<section class="section">
<h2>9. Your rights and choices</h2>
<p>Depending on your location, you may have rights to access, correct, delete, restrict, or object to certain processing, and to data portability. You may also have the right to lodge a complaint with a supervisory authority.</p>
<p>To exercise rights, contact <strong>[CONTACT_EMAIL]</strong>. We may need to verify your request and wallet or account ownership before acting.</p>
</section>
<section class="section">
<h2>10. Children</h2>
<p>The Service is not directed to children under the age where parental consent is required in your jurisdiction. We do not knowingly collect personal data from those children.</p>
</section>
<section class="section">
<h2>11. Your responsibilities for content</h2>
<p>If you pin personal data, you are responsible for lawful processing, notices, and consents. Minimize personal data in pinned objects where possible.</p>
</section>
<section class="section">
<h2>12. California residents (CCPA/CPRA summary)</h2>
<p>California residents may have additional rights, including to know, delete, and correct personal information, and to opt out of certain sharing (we do not sell personal information as defined above). Submit requests to <strong>[CONTACT_EMAIL]</strong>. We will not discriminate for exercising rights.</p>
</section>
<section class="section">
<h2>13. Changes to this policy</h2>
<p>We may update this Privacy Policy by posting a revised version and updating the effective date. Where required, we will provide additional notice.</p>
</section>
<section class="section">
<h2>14. Contact</h2>
<p><strong>[BUSINESS_ENTITY_NAME]</strong> &mdash; <strong>[CONTACT_EMAIL]</strong></p>
</section>
<p class="note">Tailor legal bases, transfers, retention schedules, and region-specific sections with qualified counsel. Align payment-related wording with your actual processors and flows.</p>
<p class="stamp"><strong>Effective:</strong> [EFFECTIVE_DATE] &middot; <strong>Version:</strong> 2026-05-06</p>`);
}

export function refundPolicyHtml(): string {
  return legalPageHtml('Refund Policy', `<h1>Refund Policy</h1>
<p class="lede">This Refund Policy explains how <strong>[BUSINESS_ENTITY_NAME]</strong> (&ldquo;we,&rdquo; &ldquo;us&rdquo;) handles refund requests for fees charged through Tack (the &ldquo;Service&rdquo;). On-chain and protocol settlements may be irreversible; this policy is boilerplate and should be reviewed by counsel.</p>
<div class="callout"><strong>Contact:</strong> [CONTACT_EMAIL] &middot; <strong>Effective:</strong> [EFFECTIVE_DATE]</div>
<section class="section">
<h2>1. Scope</h2>
<p>This policy applies to fees paid for Service usage (for example pinning, retrieval, or other paid endpoints) as described at the time of charge. It does not override mandatory consumer rights in your jurisdiction where applicable.</p>
</section>
<section class="section">
<h2>2. General rule</h2>
<p>Except as stated below, fees are <strong>non-refundable</strong> after a payment has successfully settled on-chain or through the applicable payment protocol or facilitator. Network gas, facilitator, or third-party fees may be non-recoverable.</p>
</section>
<section class="section">
<h2>3. When we may issue a refund or credit</h2>
<p>At our sole discretion, we may issue a refund or service credit if we verify one of the following:</p>
<ul>
  <li><strong>Duplicate charge:</strong> the same operation was charged more than once due to a processing error.</li>
  <li><strong>Service failure:</strong> the paid operation did not complete due to a confirmed fault in our systems (not third-party networks, client errors, or IPFS availability outside our control).</li>
  <li><strong>Billing error:</strong> the amount charged materially deviates from the price shown in the applicable payment challenge or published quote due to our error.</li>
</ul>
<p>We may provide a credit toward future use instead of a monetary refund where operationally appropriate.</p>
</section>
<section class="section">
<h2>4. When we typically do not refund</h2>
<ul>
  <li>User mistake (wrong CID, wrong parameters, wrong wallet, or similar).</li>
  <li>Content unavailability, slowness, or loss on IPFS or other networks not attributable solely to our documented Service failure.</li>
  <li>Volatility in network fees, exchange rates, or token prices.</li>
  <li>Losses from compromised wallets, phishing, or unauthorized use of your credentials.</li>
  <li>Violations of our <a href="/terms">Terms of Service</a> or payment-provider rules, including acceptable-use restrictions common to merchant-of-record and card-network programs.</li>
  <li>Requests made after our stated deadline for disputes (if any) or without adequate verification.</li>
</ul>
</section>
<section class="section">
<h2>5. How to request a refund or credit</h2>
<p>Email <strong>[CONTACT_EMAIL]</strong> with:</p>
<ul>
  <li>wallet address used for the payment;</li>
  <li>transaction hash, payment receipt, or protocol reference identifier;</li>
  <li>approximate time (UTC) and endpoint or operation;</li>
  <li>request or correlation ID returned by the Service, if any;</li>
  <li>a concise explanation of the issue.</li>
</ul>
<p>We may require additional proof of ownership or logs to prevent fraud.</p>
</section>
<section class="section">
<h2>6. Review timeline</h2>
<p>We aim to acknowledge requests within a reasonable time and to complete review within <strong>30 (thirty)</strong> business days after we receive complete information. Complex cases (for example chain reorganizations, facilitator disputes, or third-party processor investigations) may take longer.</p>
</section>
<section class="section">
<h2>7. Outcome and method</h2>
<p>If approved, refunds or credits are issued through a method compatible with the original payment flow (for example on-chain return where feasible, or processor-mediated reversal where available). Timing depends on networks, facilitators, and banks; we do not control final settlement speed.</p>
<p>Fees that were passed through to third parties may not be recoverable even when we approve a partial refund.</p>
</section>
<section class="section">
<h2>8. Chargebacks and payment disputes</h2>
<p>If you initiate a chargeback or payment-network dispute, we may share records with processors and card networks. Abuse of dispute mechanisms may result in suspension. Where a chargeback is resolved in our favor, no duplicate refund is owed.</p>
</section>
<section class="section">
<h2>9. Changes</h2>
<p>We may update this policy by posting a new version. The effective date at the top reflects the current version.</p>
</section>
<section class="section">
<h2>10. Contact</h2>
<p><strong>[BUSINESS_ENTITY_NAME]</strong> &mdash; <strong>[CONTACT_EMAIL]</strong></p>
</section>
<p class="note">Adjust the review timeline to match your operational SLA. Align refund mechanics with your actual payment rails and accounting. Restricted categories of activity may affect eligibility under processor terms.</p>
<p class="stamp"><strong>Effective:</strong> [EFFECTIVE_DATE] &middot; <strong>Version:</strong> 2026-05-06</p>`);
}

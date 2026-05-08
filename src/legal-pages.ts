/**
 * Generic legal page template for Taiko products.
 *
 * Pass a LegalConfig to each exported function. The same HTML generator
 * works for every product (Tack, Okidori, Bantō, …) — swap the config,
 * get the right document.
 */

export interface LegalConfig {
  /** Displayed product name, e.g. "Tack" or "Okidori" */
  productName: string;
  /** Legal entity operating the service, e.g. "Taiko Labs Limited" */
  businessEntityName: string;
  /** Primary legal / privacy contact email */
  contactEmail: string;
  /** Effective date string, e.g. "May 8, 2026" */
  effectiveDate: string;
  /** Home / landing page URL used in the header back-link */
  homeUrl: string;
  /** Short human-readable service description, e.g. "IPFS pinning and retrieval service for AI agents" */
  serviceDescription: string;
  /** Channels through which the service is offered, e.g. "website and API" */
  serviceChannels: string;
  /** Governing law jurisdiction, e.g. "the Cayman Islands" */
  governingLaw: string;
  /** Dispute venue, e.g. "Grand Cayman, Cayman Islands" */
  venue: string;
  /** Aggregate liability cap clause, e.g. "one hundred U.S. dollars (USD $100)" */
  liabilityCapAmount: string;
  /** Include KYC / AML identity-verification language (default false) */
  hasKyc?: boolean;
  /** Include NFT / token-specific IP and royalty language (default false) */
  hasNft?: boolean;
  /** Include IPFS / CID storage, DMCA, and AI-agent content language (default false) */
  hasIpfs?: boolean;
  /** Minimum user age, defaults to "18" */
  ageRequirement?: string;
  /** Blockchain name shown in web3 notices, defaults to "Taiko / Ethereum" */
  blockchain?: string;
  /** Favicon path, defaults to "/favicon.svg" */
  faviconUrl?: string;
}

// ---------------------------------------------------------------------------
// Shared HTML shell
// ---------------------------------------------------------------------------

function legalPageHtml(config: LegalConfig, title: string, body: string): string {
  const { productName, homeUrl } = config;
  const slug = productName.toLowerCase();
  const favicon = config.faviconUrl ?? '/favicon.svg';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | ${productName}</title>
  <meta name="description" content="${title} for ${productName}." />
  <meta name="theme-color" content="#05070d" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,400..700,30..100;1,9..144,400..700,30..100&family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
  <link rel="icon" href="${favicon}" type="image/svg+xml" />
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
      --ink-50:  #f1f3f9;
      --pink-200: #ffa1d6;
      --pink-300: #e81899;
      --pink-100: #ffd9ee;
      --f-body:    'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --f-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      --f-display: 'Fraunces', ui-serif, 'Iowan Old Style', 'Apple Garamond', Georgia, serif;
      --bg:     var(--ink-950);
      --panel:  color-mix(in oklab, var(--ink-850) 92%, black);
      --text:   var(--ink-50);
      --muted:  var(--ink-200);
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
    .container { max-width: 860px; margin: 0 auto; padding: 28px 20px 56px; }
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
    .back { color: var(--ink-300); text-decoration: none; font-size: 14px; font-family: var(--f-mono); }
    .back:hover { color: var(--text); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 22px 22px 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,.24);
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
    h3 { margin: 18px 0 8px; font-size: 1rem; color: var(--text); }
    p, li { color: var(--muted); font-size: clamp(.98rem, 1.1vw, 1.04rem); line-height: 1.62; }
    p { margin: 10px 0; }
    ul { margin: 10px 0 10px 18px; }
    strong { color: var(--text); }
    .lede { font-size: clamp(1.05rem, 1.6vw, 1.2rem); color: var(--text); margin-bottom: 14px; }
    .section { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border); }
    .section:first-of-type { margin-top: 14px; padding-top: 0; border-top: 0; }
    .note { margin-top: 12px; font-size: 12.5px; color: var(--muted); font-family: var(--f-mono); line-height: 1.5; }
    .callout {
      margin: 14px 0 8px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid color-mix(in oklab, var(--pink-300) 40%, transparent);
      background: color-mix(in oklab, var(--pink-300) 12%, transparent);
      color: var(--pink-100);
      font-size: 14px;
    }
    .stamp { margin-top: 18px; font-size: 12px; color: var(--muted); font-family: var(--f-mono); letter-spacing: .01em; }
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
      <a class="brand" href="${homeUrl}" aria-label="${productName} home"><span class="slash">/</span>${slug}</a>
      <a class="back" href="${homeUrl}">Back to home</a>
    </div>
    <article class="panel">
      ${body}
    </article>
  </main>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Terms of Service
// ---------------------------------------------------------------------------

export function termsOfServiceHtml(config: LegalConfig): string {
  const age = config.ageRequirement ?? '18';
  return legalPageHtml(config, 'Terms of Service', `<h1>Terms of Service</h1>
<p class="lede">These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of ${config.productName} and its related interfaces (collectively, the &ldquo;Service&rdquo;), operated by <strong>${config.businessEntityName}</strong>. By accessing or using the Service you agree to these Terms. If you do not agree, do not use the Service.</p>
<div class="callout"><strong>Important:</strong> You must comply with all applicable laws, including sanctions regulations and, where relevant, card-network and payment-provider acceptable-use rules. Violations may result in immediate suspension.</div>

<section class="section">
<h2>1. Parties and agreement</h2>
<p>The Service is operated by <strong>${config.businessEntityName}</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). These Terms form a binding agreement between you and us. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization, and &ldquo;you&rdquo; refers to both you and that organization.</p>
<p><strong>Effective date:</strong> ${config.effectiveDate}</p>
</section>

<section class="section">
<h2>2. Eligibility and sanctions</h2>
<p>You must be at least ${age} years old and have legal capacity to enter these Terms. Your use of the Service must comply with all laws applicable to you.</p>
<p><strong>Sanctions certification.</strong> By accessing or using the Service, you certify that you are not: (a)&nbsp;located in, ordinarily resident in, or organized under the laws of any jurisdiction subject to comprehensive economic sanctions imposed by the United States (OFAC), the United Nations Security Council, the European Union, or the United Kingdom&mdash;including, without limitation, Cuba, Iran, North Korea, Syria, Russia, and the Crimea, Donetsk, or Luhansk regions of Ukraine; (b)&nbsp;identified on any sanctions list or denied-parties list maintained by those authorities, including the OFAC Specially Designated Nationals and Blocked Persons List; or (c)&nbsp;50% or more owned or controlled, directly or indirectly, by any person or entity meeting the foregoing criteria. We reserve the right to block or suspend access without notice or liability if we reasonably believe a sanctions concern exists.</p>
</section>

<section class="section">
<h2>3. Service description</h2>
<p>${config.productName} provides ${config.serviceDescription} via its ${config.serviceChannels}. Features, endpoints, pricing, and availability may change. Documentation and API responses describe Service behavior at a given time and do not constitute forward-looking commitments.</p>
${config.hasIpfs ? `<p>Storage operations are distributed across decentralized infrastructure. Replication, durability, and geographic distribution depend on configuration and network conditions. Unless expressly stated otherwise in writing, we do not guarantee specific replication factors, availability zones, or retrieval latency.</p>` : ''}
</section>

<section class="section">
<h2>4. Accounts, wallets, and security</h2>
<p>The Service uses wallet-based identity and signed requests. You are solely responsible for safeguarding your wallets, private keys, credentials, and devices.</p>
<ul>
  <li>Use only wallets and signing keys you are authorized to control.</li>
  <li>Do not attempt to bypass authentication, impersonate another party, or gain unauthorized access to content or resources that are not yours.</li>
  <li>Notify us promptly at <strong>${config.contactEmail}</strong> if you suspect unauthorized use of your wallet or owner credentials.</li>
  ${config.hasIpfs ? '<li>If AI agents interact with the Service using credentials or wallets under your control, you are fully responsible for all actions those agents take on your behalf, including content they submit or retrieve.</li>' : ''}
</ul>
</section>

<section class="section">
<h2>5. Fees, taxes, and payments</h2>
<p>Certain operations require payment via supported protocols, networks, or payment processors. Amounts, timing, and settlement mechanics may depend on third-party facilitators, blockchains, and wallet software.</p>
<p>You are responsible for all taxes arising from your use of the Service, except where applicable law places that obligation on us. Payment processing is subject to network fees, facilitator rules, and rejection or reversal events outside our reasonable control.</p>
</section>

<section class="section">
<h2>6. Blockchain and network risks</h2>
<p>By using the Service you acknowledge and accept risks inherent to blockchain-based systems:</p>
<ul>
  <li><strong>Irreversibility.</strong> Confirmed blockchain transactions cannot be reversed, recalled, or cancelled. Verify all transaction parameters before signing or submitting.</li>
  <li><strong>Network congestion and fees.</strong> Transaction processing times and gas costs may vary significantly. We do not control and are not responsible for network fees, delays, or failed transactions caused by network conditions.</li>
  <li><strong>Smart contract risk.</strong> The Service may interact with smart contracts that could contain bugs, vulnerabilities, or produce unintended behavior. We are not responsible for losses caused by smart contract execution, protocol failures, or third-party infrastructure.</li>
  <li><strong>Fork and protocol risk.</strong> Blockchain networks may undergo forks, consensus changes, or other protocol-level events that affect asset availability or transaction outcomes.</li>
  <li><strong>Private key custody.</strong> You are solely responsible for the security and backup of your private keys. Loss or compromise of private keys may result in permanent, irrecoverable loss of assets. We have no ability to restore access or recover credentials.</li>
  <li><strong>Third-party protocols.</strong> Protocols, bridges, and infrastructure used in connection with the Service may change, be discontinued, or become unavailable without notice.</li>
</ul>
</section>

<section class="section">
<h2>7. Acceptable use</h2>
<p>You agree to use the Service only for lawful purposes and in compliance with these Terms and applicable law. You must not:</p>
<ul>
  <li>violate any law or regulation, or infringe third-party intellectual property, privacy, or publicity rights;</li>
  <li>upload, submit, distribute, or facilitate unlawful, fraudulent, deceptive, abusive, harassing, or discriminatory content or activity;</li>
  <li>attempt to disrupt, degrade, or gain unauthorized access to the Service, its users, or underlying infrastructure;</li>
  <li>use the Service to conduct, facilitate, or obscure transactions with sanctioned persons, entities, or jurisdictions;</li>
  <li>use automated systems or bots to abuse, scrape, or overload the Service in a manner inconsistent with normal use or our published rate limits;</li>
  <li>process personal data through the Service without a lawful basis, appropriate notices, and, where required, consent under applicable data protection laws (including the GDPR).</li>
</ul>
</section>

<section class="section">
<h2>8. Prohibited offerings and payment-compliance categories</h2>
<p>To reduce fraud, chargeback, sanctions, and card-network risk, you must not use the Service (including paid flows) in connection with the following categories. This list is illustrative, not exhaustive:</p>
<ul>
  <li><strong>Physical goods or delivery.</strong> Products whose primary fulfillment requires shipping tangible items outside the scope of licensed software.</li>
  <li><strong>Non-software primary services.</strong> Human services not integrated with a bona fide software product (e.g., standalone consulting or coaching without a substantive software deliverable), where disallowed by your payment path.</li>
  <li><strong>Donations and crowdfunding without a product.</strong> Charitable solicitation, community access, or sponsorship where no genuine software or digital service is sold, if disallowed by your processor.</li>
  <li><strong>Intellectual property abuse.</strong> Piracy, unauthorized redistribution, illicit streaming, circumvention tools, or other infringement of copyrights, trademarks, or license terms.</li>
  <li><strong>Unauthorized access and surveillance tools.</strong> Spyware, stalkerware, keyloggers, RATs, credential stuffing tools, or similar offerings.</li>
  <li><strong>Payment intermediation.</strong> Operating as a marketplace or payment intermediary enabling unrelated third parties to sell through your account, where prohibited.</li>
  <li><strong>Pyramid and high-risk marketing schemes.</strong> MLM, pyramid schemes, mass-messaging blasts, automated engagement manipulation, or deceptive &ldquo;get rich quick&rdquo; schemes.</li>
  <li><strong>Age-restricted sexual content.</strong> Pornography or sexual services where restricted.</li>
  <li><strong>Gambling and games of chance.</strong> Betting, wagering, lotteries, or sweepstakes with cash or material prizes, where restricted.</li>
  <li><strong>Unlicensed financial and money services.</strong> Money transmission, unlicensed crypto exchange or trading, investment or credit advice, or other categories treated as high-risk by card networks or regulators.</li>
  <li><strong>Deceptive or harmful AI and synthetic media.</strong> Non-consensual deepfakes, voice impersonation for fraud, or synthetic identities used to deceive.</li>
  <li><strong>Other restricted categories.</strong> Categories commonly restricted by payment processors or card networks (e.g., certain health claims, government-impersonation services, captcha-solving for abuse), as applicable to your payment path.</li>
</ul>
<p>We may suspend or terminate access that appears likely to violate payment-provider or card-network rules, even if not explicitly listed above.</p>
</section>

<section class="section">
<h2>9. Content, uploads, and license</h2>
<p>You retain all rights you hold in content you provide to the Service. By submitting content, you grant us a non-exclusive, worldwide, royalty-free license to host, store, process, transmit, and display your content solely as needed to operate the Service, enforce these Terms, and comply with law. You represent that you have all rights necessary to submit content through the Service and that doing so does not violate any third-party rights or applicable law.</p>
${config.hasIpfs ? `
<h3>IPFS network and content permanence</h3>
<p>When content is pinned through the Service, it may propagate to other nodes across the IPFS network and remain retrievable even after you request removal or unpinning from our infrastructure. Removing content from our hosted nodes does not guarantee its removal from the broader IPFS network or from other parties who have independently retrieved or re-pinned it. Do not submit content that you need to keep confidential or that you may need to delete permanently.</p>
<h3>Copyright notices (DMCA)</h3>
<p>If you believe content accessible through the Service infringes your copyright, send a written notice to <strong>${config.contactEmail}</strong> that includes: (a)&nbsp;identification of the copyrighted work claimed to be infringed; (b)&nbsp;identification of the allegedly infringing content with information sufficient to locate it; (c)&nbsp;your contact information; (d)&nbsp;a statement of good-faith belief that the use is not authorized by the copyright owner, its agent, or law; and (e)&nbsp;a statement, under penalty of perjury, that the information is accurate and you are authorized to act on behalf of the copyright owner. We will process valid notices in accordance with the DMCA (17&nbsp;U.S.C.&nbsp;&sect;&nbsp;512). Counter-notification rights apply if content is removed in error. Filing false or abusive takedown notices may expose you to liability for damages.</p>
<h3>AI agent content</h3>
<p>If AI agents interact with the Service on your behalf, you are responsible for all content those agents submit, store, or retrieve. Agent actions are treated as your actions for purposes of these Terms.</p>` : ''}
${config.hasNft ? `
<h3>NFT purchases and intellectual property</h3>
<p>Purchasing, transferring, or holding a non-fungible token (NFT) through the Service does not automatically convey any intellectual property rights in the underlying digital content, artwork, or associated assets unless the creator expressly grants such rights in a separate written agreement. We do not adjudicate or enforce IP arrangements between creators and buyers.</p>
<h3>Creator representations</h3>
<p>By minting or listing an NFT through the Service, you represent and warrant that you own or have obtained all necessary licenses, rights, consents, and permissions to create, list, and sell the associated content, and that doing so does not infringe any third-party intellectual property, privacy, or publicity rights.</p>
<h3>Royalties</h3>
<p>Where creators have programmed royalty parameters into smart contracts, we display royalty information as configured but do not guarantee collection, enforcement, or portability of royalties across secondary sales or other platforms.</p>
<h3>NFT transactions</h3>
<p>NFT sales and transfers execute through smart contracts on a peer-to-peer basis. We are not a party to individual transactions and do not take custody of NFTs or sale proceeds.</p>` : ''}
</section>

<section class="section">
<h2>10. Our intellectual property</h2>
<p>Except for content you provide, the Service, its branding, documentation, and underlying technology are owned by us or our licensors. No rights are granted beyond those expressly set out in these Terms.</p>
</section>

<section class="section">
<h2>11. Privacy</h2>
<p>Our <a href="/privacy">Privacy Policy</a> explains how we collect, use, and share information. It is incorporated into these Terms by reference.</p>
</section>

<section class="section">
<h2>12. Availability; changes; suspension</h2>
<p>The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We may modify, limit, or discontinue features; impose rate limits; and perform maintenance, with or without notice.</p>
<p>We may suspend or terminate your access if you breach these Terms, create risk to the Service or its users, violate sanctions or export controls, or if required by law or a competent authority.</p>
</section>

<section class="section">
<h2>13. No financial or investment advice</h2>
<p>Nothing provided through the Service&mdash;including documentation, pricing signals, API responses, or any communications from us&mdash;constitutes financial, investment, legal, tax, or other professional advice. The Service provides software infrastructure only. All decisions regarding digital assets, transactions, or related activities are solely yours, and you should consult qualified independent advisors. We make no representation about the value, suitability, or regulatory status of any digital asset or protocol.</p>
</section>

<section class="section">
<h2>14. Disclaimer of warranties</h2>
<p>To the fullest extent permitted by law, we disclaim all warranties&mdash;express, implied, or statutory&mdash;including warranties of merchantability, fitness for a particular purpose, title, non-infringement, and any warranty that the Service will be uninterrupted, error-free, secure, or free from harmful components.</p>
</section>

<section class="section">
<h2>15. Limitation of liability</h2>
<p>To the maximum extent permitted by law, we and our affiliates, directors, employees, agents, and suppliers will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenue, data, goodwill, or business opportunity, even if advised of the possibility of such damages.</p>
<p>Our total aggregate liability for all claims arising out of or relating to the Service or these Terms will not exceed the greater of (a)&nbsp;the amounts you paid to us in the three (3) months before the event giving rise to liability, or (b)&nbsp;${config.liabilityCapAmount}, except where applicable law prohibits such a limitation.</p>
</section>

<section class="section">
<h2>16. Indemnity</h2>
<p>You will defend, indemnify, and hold harmless ${config.businessEntityName} and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising from or relating to: (a)&nbsp;your content or submissions; (b)&nbsp;your use of the Service; (c)&nbsp;your breach of these Terms or applicable law; or (d)&nbsp;your violation of any third-party right, including intellectual property or privacy rights.</p>
</section>

<section class="section">
<h2>17. Sanctions and export controls</h2>
<p>You must comply with all applicable economic sanctions, export control, and trade restriction laws, including regulations administered by OFAC, the UN Security Council, the European Union, and the UK Office of Financial Sanctions Implementation (OFSI).</p>
<p>You must not use the Service to conduct, facilitate, or conceal transactions with or for the benefit of sanctioned persons, entities, or jurisdictions; to export, re-export, or transfer goods, software, or technology in violation of applicable export control laws; or to otherwise circumvent applicable trade restrictions.</p>
<p>We reserve the right to restrict or block access to the Service, without prior notice or liability, for any user or entity that appears to be located in a comprehensively sanctioned jurisdiction or listed on a government sanctions or denied-parties list. Any use of the Service in violation of sanctions or export controls is a material breach of these Terms and will result in immediate termination.</p>
</section>

<section class="section">
<h2>18. Governing law and venue</h2>
<p>These Terms are governed by the laws of <strong>${config.governingLaw}</strong>, without regard to conflict-of-law rules. You agree that exclusive jurisdiction and venue for any dispute arising out of or relating to these Terms or the Service will lie in the courts located in <strong>${config.venue}</strong>, subject to mandatory consumer protection rights that may apply in your jurisdiction.</p>
</section>

<section class="section">
<h2>19. General</h2>
<ul>
  <li><strong>Entire agreement.</strong> These Terms and the policies incorporated by reference constitute the entire agreement between you and us regarding the Service.</li>
  <li><strong>Severability.</strong> If any provision is found invalid or unenforceable, the remaining provisions continue in full force.</li>
  <li><strong>No waiver.</strong> Failure to enforce any provision does not constitute a waiver of our right to enforce it later.</li>
  <li><strong>Assignment.</strong> You may not assign these Terms or any rights under them without our prior written consent. We may assign these Terms in connection with a merger, acquisition, reorganization, or sale of assets.</li>
  <li><strong>Force majeure.</strong> We are not liable for delays or failures caused by events beyond our reasonable control, including network failures, acts of government, or natural disasters.</li>
</ul>
</section>

<section class="section">
<h2>20. Contact and updates</h2>
<p>Questions about these Terms: <strong>${config.contactEmail}</strong>. We may update these Terms by posting a revised version. Material changes will be indicated by updating the effective date. Continued use of the Service after the updated effective date constitutes acceptance of the revised Terms.</p>
</section>
<p class="note">Not legal advice. Have qualified counsel review governing-law selection, liability caps, sanctions compliance obligations, and payment-processor requirements for your specific entity and jurisdictions before relying on these Terms in production.</p>
<p class="stamp"><strong>Effective:</strong> ${config.effectiveDate} &middot; <strong>Version:</strong> 2026-05-08</p>`);
}

// ---------------------------------------------------------------------------
// Privacy Policy
// ---------------------------------------------------------------------------

export function privacyPolicyHtml(config: LegalConfig): string {
  const age = config.ageRequirement ?? '18';
  const chain = config.blockchain ?? 'Taiko / Ethereum';
  return legalPageHtml(config, 'Privacy Policy', `<h1>Privacy Policy</h1>
<p class="lede">${config.productName} explains in this Privacy Policy how <strong>${config.businessEntityName}</strong> (&ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, and shares information when you use our ${config.serviceChannels} (the &ldquo;Service&rdquo;). The Service is for users aged <strong>${age}+</strong> only.</p>
<div class="callout"><strong>Web3 notice:</strong> Activity on public blockchains (e.g., ${chain})&mdash;wallet addresses, transactions, on-chain metadata&mdash;is <strong>public and may be permanent</strong>. We cannot alter or delete records that exist on decentralized networks.</div>
<div class="callout"><strong>Controller:</strong> ${config.businessEntityName} &mdash; <strong>Contact:</strong> ${config.contactEmail} &mdash; <strong>Effective:</strong> ${config.effectiveDate}</div>

<section class="section">
<h2>1. Information we collect</h2>

<h3>Information you provide</h3>
<p>Optional profile or account details (e.g., email address, username, avatar, social links); preferences; support messages and feedback.</p>

${config.hasKyc ? `<h3>Identity verification (KYC / AML)</h3>
<p>If identity verification is enabled or required by law, we may collect: full legal name, date of birth, residential address, government-issued ID documents, selfies and liveness-check results, and sanctions and Politically Exposed Persons (PEP) screening results.</p>` : ''}

<h3>Wallet-based access</h3>
<p>Your blockchain wallet address is your primary identifier on the Service. A wallet address alone may not identify you as an individual, but it can be linked to other information you provide or that we observe.</p>

<h3>Automatically collected data</h3>
<p>Usage and device data including IP address and approximate location, browser type and operating system, device identifiers, wallet software type, timestamps, clickstream data, request logs, performance and error telemetry, and anti-fraud signals. We use cookies and similar technologies for essential functions, analytics, and service continuity. &ldquo;Do Not Track&rdquo; signals are not currently acted upon due to the absence of a uniform standard.</p>

${config.hasIpfs ? `<h3>Pinning and content metadata</h3>
<p>Content identifiers (CIDs), pin identifiers, file sizes, retention durations, replication status, and similar storage attributes. We generally do not index file contents for billing purposes, but content submitted to the Service may be processed as part of storage and retrieval operations.</p>` : ''}

<h3>From third parties</h3>
<p>We may receive data from wallet providers, analytics and security vendors${config.hasKyc ? ', identity and KYC service providers' : ''}, blockchain data providers, and other service providers.</p>

<h3>Public blockchain sources</h3>
<p>We process publicly visible on-chain data${config.hasNft ? ' (e.g., NFT transactions, token IDs, on-chain metadata)' : ''} and may associate it with information you have provided.</p>
</section>

<section class="section">
<h2>2. How we use information</h2>
<p>We use information to:</p>
<ul>
  <li>provide, operate, and maintain the Service;</li>
  <li>authenticate requests and enforce access controls;</li>
  <li>analyze, improve, and personalize the Service;</li>
  <li>communicate service-related notices; send marketing communications with your consent where required;</li>
  <li>process and reconcile payments, detect fraud, and satisfy payment-network obligations;</li>
  <li>maintain safety, security, and integrity; detect and investigate fraud and abuse; enforce our Terms;</li>
  <li>comply with law, respond to lawful requests, and cooperate with authorities; and</li>
  <li>create de-identified or aggregated insights that do not re-identify you unless permitted by law.</li>
</ul>
<p><strong>Legal bases (EEA / UK):</strong> Where the GDPR or UK GDPR applies, we rely on: performance of a contract with you; our legitimate interests (e.g., security, fraud prevention, service improvement), balanced against your rights; compliance with a legal obligation; and your consent where specifically required. We do not use solely automated decision-making with legal or similarly significant effects without human involvement, except where necessary to prevent fraud or comply with law.</p>
</section>

<section class="section">
<h2>3. How we share information</h2>
<p>We <strong>do not sell</strong> your personal information and do <strong>not share</strong> it for cross-context behavioral advertising.</p>
<p>We may disclose information to:</p>
<ul>
  <li><strong>Service providers and processors:</strong> infrastructure and hosting; blockchain RPC and indexers; analytics and error monitoring; email and CRM; customer support; anti-fraud${config.hasKyc ? ', AML, and KYC vendors' : ''}; storage${config.hasIpfs ? ' and IPFS pinning' : ''}; content moderation;</li>
  <li><strong>Affiliates</strong> (subject to this Policy) and in connection with <strong>corporate transactions</strong> such as mergers, acquisitions, or asset sales;</li>
  <li>to <strong>comply with law</strong>, legal process, court orders, or to protect the rights, property, and safety of us, our users, or the public; and</li>
  <li>with your explicit <strong>direction or consent</strong>.</li>
</ul>
<p>We may display or share public blockchain activity through APIs and data tools. Where applicable, we honor <strong>Global Privacy Control (GPC)</strong> signals as an opt-out of &ldquo;sale or sharing&rdquo; of personal information under the CPRA and similar laws.</p>
</section>

<section class="section">
<h2>4. Third-party services and wallets</h2>
<p>The Service may link to or integrate with third-party websites, protocols, or services whose privacy practices are governed by their own policies. Use of a third-party wallet is subject to that provider&rsquo;s terms and privacy policy. Keep your wallet credentials and private keys secure; we cannot recover them if lost.</p>
</section>

<section class="section">
<h2>5. Your data rights</h2>
<p>Depending on your location, you may have rights to <strong>access</strong>, <strong>copy and port</strong>, <strong>correct</strong>, <strong>delete</strong> (off-chain data), <strong>restrict or object to</strong> processing, and <strong>withdraw consent</strong>. These rights are not absolute and may be limited by legal obligations or other grounds.</p>
<p><strong>How to exercise rights:</strong> Contact us at <strong>${config.contactEmail}</strong>. We may verify your identity via <strong>wallet signature</strong> and/or email${config.hasKyc ? '; if KYC was conducted, we may additionally verify via ID document consistent with applicable law' : ''}. Authorized agents must provide proof of authority, and we may also require verification from you directly. We will not discriminate against you for exercising your rights. Where permitted by law, you may have the right to <strong>appeal</strong> a decision to deny your request.</p>
<p><strong>On-chain data:</strong> Rights requests cannot alter or remove data recorded on public blockchains or content stored on decentralized networks such as IPFS.</p>
<p><strong>California residents (CCPA / CPRA):</strong> You have the right to know what personal information we collect, to delete it (subject to exceptions), to correct inaccurate information, and to opt out of the sale or sharing of personal information. We do not sell personal information. Submit requests to <strong>${config.contactEmail}</strong>. We will not discriminate for exercising these rights.</p>
</section>

<section class="section">
<h2>6. Retention</h2>
<p>We retain information <strong>for as long as reasonably necessary</strong> to fulfil the purposes described in this Policy or <strong>as required or permitted by applicable law</strong> (including AML, tax, accounting, and reporting obligations), and to resolve disputes and enforce our Terms. Where no specific legal requirement applies, we determine the appropriate retention period by considering data sensitivity, the risk of unauthorized use, processing purposes, and operational needs.</p>
<p>When information is no longer needed, we will <strong>delete, anonymize, or irreversibly de-identify</strong> the data we control <strong>off-chain</strong>. <strong>On-chain</strong> records and content stored on decentralized networks cannot be altered or deleted by us. Backup archives are retained for limited rolling periods and overwritten in the ordinary course of business.</p>
</section>

<section class="section">
<h2>7. Security</h2>
<p>We apply appropriate technical and organizational measures including encryption in transit and at rest, access controls and least-privilege principles, continuous monitoring, secure development practices, and vendor security reviews. No system is completely secure. You are responsible for the security of your wallet and private keys. Be alert to phishing. We will notify affected users and relevant authorities of security incidents as required by law.</p>
</section>

<section class="section">
<h2>8. International users and data transfers</h2>
<p>Information may be processed in countries whose data protection laws differ from those in your jurisdiction. For transfers of personal data from the EEA, UK, or Switzerland, we use appropriate safeguards including <strong>EU Standard Contractual Clauses (SCCs)</strong> and, for UK transfers, the <strong>UK International Data Transfer Agreement (IDTA) or Addendum</strong>, supplemented by additional measures where required. Contact us at <strong>${config.contactEmail}</strong> for further details about applicable transfer mechanisms (redactions may apply).</p>
</section>

<section class="section">
<h2>9. Children</h2>
<p>The Service is not directed to individuals under the age of ${age}. We do not knowingly collect personal information from users below that age. If we learn that we have collected such data, we will delete it from systems we control. This does not affect publicly visible records on blockchain networks.</p>
</section>

<section class="section">
<h2>10. Your responsibilities for content</h2>
<p>If you upload, submit, or ${config.hasIpfs ? 'pin' : 'post'} content that includes personal data of third parties, you are responsible for ensuring you have a lawful basis for doing so, providing required privacy notices to those individuals, and complying with applicable data protection laws. Minimize the personal data included in ${config.hasIpfs ? 'pinned objects' : 'uploaded content'} wherever possible.</p>
</section>

<section class="section">
<h2>11. Changes to this Policy</h2>
<p>We may update this Policy and will revise the effective date. For material changes, we will provide additional notice where practicable (e.g., an in-app banner or email if we have your address).</p>
</section>

<section class="section">
<h2>12. Contact</h2>
<p><strong>${config.businessEntityName}</strong> &mdash; <strong>${config.contactEmail}</strong></p>
</section>
<p class="note">Have qualified counsel review legal bases, international transfer mechanisms, retention schedules, and jurisdiction-specific requirements before relying on this Policy in production. Align data processing descriptions with your actual technical infrastructure.</p>
<p class="stamp"><strong>Effective:</strong> ${config.effectiveDate} &middot; <strong>Version:</strong> 2026-05-08</p>`);
}

// ---------------------------------------------------------------------------
// Refund Policy
// ---------------------------------------------------------------------------

export function refundPolicyHtml(config: LegalConfig): string {
  return legalPageHtml(config, 'Refund Policy', `<h1>Refund Policy</h1>
<p class="lede">This Refund Policy explains how <strong>${config.businessEntityName}</strong> (&ldquo;we,&rdquo; &ldquo;us&rdquo;) handles refund and credit requests for fees charged through ${config.productName} (the &ldquo;Service&rdquo;). On-chain and protocol-settled transactions may be irreversible; review this Policy carefully before making payments.</p>
<div class="callout"><strong>Contact:</strong> ${config.contactEmail} &middot; <strong>Effective:</strong> ${config.effectiveDate}</div>

<section class="section">
<h2>1. Scope</h2>
<p>This Policy applies to fees paid for use of the Service as described at the time of charge. It does not override mandatory consumer rights that may apply in your jurisdiction under applicable law.</p>
</section>

<section class="section">
<h2>2. General rule</h2>
<p>Except as stated below, all fees are <strong>non-refundable</strong> once a payment has successfully settled${config.hasIpfs ? ' on-chain or' : ''} through the applicable payment protocol or facilitator. Network gas fees, facilitator charges, and third-party processing fees may be non-recoverable regardless of outcome.</p>
</section>

<section class="section">
<h2>3. When we may issue a refund or credit</h2>
<p>At our sole discretion, we may issue a refund or a service credit if we verify one of the following:</p>
<ul>
  <li><strong>Duplicate charge:</strong> the same operation was charged more than once due to a confirmed processing error on our end.</li>
  <li><strong>Service failure:</strong> the paid operation did not complete due to a confirmed fault in our systems${config.hasIpfs ? ', excluding failures caused by third-party networks, IPFS unavailability, or client-side errors' : ', excluding failures caused by third-party infrastructure or client-side errors'}.</li>
  <li><strong>Billing error:</strong> the amount charged materially deviates from the price shown in the applicable invoice, receipt, or published pricing at the time of the transaction, due to our error.</li>
</ul>
<p>We may provide a service credit toward future use instead of a monetary refund where operationally appropriate.</p>
</section>

<section class="section">
<h2>4. When we typically do not refund</h2>
<ul>
  <li>User error (e.g., incorrect parameters${config.hasIpfs ? ', wrong CID,' : ''} wrong wallet address, or unintended submissions).</li>
  ${config.hasIpfs ? '<li>Content unavailability, retrieval slowness, or data loss on the IPFS network or third-party infrastructure not solely attributable to a documented Service failure.</li>' : '<li>Content unavailability or loss on third-party infrastructure not solely attributable to a documented Service failure.</li>'}
  <li>Volatility in network fees, exchange rates, or token prices.</li>
  <li>Losses arising from compromised wallets, phishing attacks, or unauthorized use of your credentials.</li>
  <li>Violations of our <a href="/terms">Terms of Service</a>, payment-provider rules, or applicable law.</li>
  <li>Requests submitted after any applicable dispute deadline or without adequate supporting information to verify the claim.</li>
</ul>
</section>

<section class="section">
<h2>5. How to request a refund or credit</h2>
<p>Email <strong>${config.contactEmail}</strong> and include:</p>
<ul>
  <li>the wallet address used for the payment;</li>
  <li>the transaction hash, payment receipt, or protocol reference identifier;</li>
  <li>the approximate date and time (UTC) of the transaction and the endpoint or operation involved;</li>
  <li>any request or correlation ID returned by the Service; and</li>
  <li>a concise description of the issue and the remedy you are seeking.</li>
</ul>
<p>We may request additional documentation or proof of wallet ownership to prevent fraudulent claims.</p>
</section>

<section class="section">
<h2>6. Review timeline</h2>
<p>We aim to acknowledge requests promptly and to complete our review within <strong>30 (thirty) business days</strong> of receiving complete information. Complex cases&mdash;for example those involving chain reorganizations, facilitator disputes, or third-party processor investigations&mdash;may require additional time, and we will communicate any extensions.</p>
</section>

<section class="section">
<h2>7. Outcome and payment method</h2>
<p>Where a refund is approved, we will issue it through a method compatible with the original payment flow (e.g.,${config.hasIpfs ? ' an on-chain return where feasible, or' : ''} a processor-mediated reversal where available). Final settlement timing depends on networks, facilitators, and financial institutions; we do not control settlement speed. Fees passed through to third parties may not be recoverable even where we approve a partial refund.</p>
</section>

<section class="section">
<h2>8. Chargebacks and payment disputes</h2>
<p>If you initiate a chargeback or payment-network dispute before contacting us, we may share transaction records with processors, card networks, and relevant authorities to contest the dispute. Repeated or abusive use of dispute mechanisms may result in suspension of your access. Where a chargeback or dispute is resolved in our favor, no additional refund or credit is owed.</p>
</section>

<section class="section">
<h2>9. Changes</h2>
<p>We may update this Policy by posting a revised version. The effective date reflects the currently applicable version. Continued use of the Service after an update constitutes acceptance of the revised Policy.</p>
</section>

<section class="section">
<h2>10. Contact</h2>
<p><strong>${config.businessEntityName}</strong> &mdash; <strong>${config.contactEmail}</strong></p>
</section>
<p class="note">Adjust the review timeline to match your operational SLA. Align refund mechanics with your actual payment rails and accounting requirements. Restricted-category violations may affect eligibility under processor terms.</p>
<p class="stamp"><strong>Effective:</strong> ${config.effectiveDate} &middot; <strong>Version:</strong> 2026-05-08</p>`);
}

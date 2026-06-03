const PROD_URL = process.env.LANDING_URL ?? 'https://tack.inferenceroom.ai';

export const googleSiteVerification = {
  filename: 'googlee642389cdf7297cd.html',
  content: 'google-site-verification: googlee642389cdf7297cd.html\n',
};

export const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64">
  <rect width="128" height="64" fill="#0a0a0a"/>
  <path d="M23 14 12 50" stroke="#ff1566" stroke-width="5" stroke-linecap="round"/>
  <text x="33" y="46" fill="#f0ede4" font-family="'IBM Plex Mono', ui-monospace, monospace" font-size="30" font-weight="700" letter-spacing="-0.02em">tack</text>
</svg>`;

export function landingPageHtml(): string {
  const o = PROD_URL;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tack — wallet-owned storage for AI Agents. Pin to IPFS or keep private.</title>
  <meta name="description" content="Wallet-owned storage for AI Agents: pin to IPFS or keep state private. Pay-per-use in USDC over x402 and MPP. Live on Taiko, Base, and Tempo." />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <meta name="google-site-verification" content="f0O2UCeDjyTIobYVVAHT8TyhtvwJ1TJqfMsblwzQgR4" />
  <link rel="canonical" href="${o}" />
  <meta name="theme-color" content="#0a0a0a" />
  <link rel="icon" href="/favicon.svg?v=tack-redesign-20260519" type="image/svg+xml" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="Tack — wallet-owned storage for AI Agents." />
  <meta property="og:description" content="A place for your Agent to keep things. Pin to IPFS or keep private, same wallet, same rails. Pay-per-use, no API keys." />
  <meta property="og:url" content="${o}" />
  <meta property="og:site_name" content="Tack" />
  <meta property="og:image" content="${o}/og.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Tack — wallet-owned storage for AI Agents." />
  <meta name="twitter:description" content="A place for your Agent to keep things. Pin to IPFS or keep private, same wallet, same rails. Pay-per-use, no API keys." />
  <meta name="twitter:image" content="${o}/og.png" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Tack",
    "description": "Wallet-owned storage for AI Agents. Pin to IPFS or keep state private, paid per use in USDC over x402 and MPP.",
    "url": "${o}",
    "brand": { "@type": "Brand", "name": "Tack" },
    "category": "Storage infrastructure for AI Agents",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "USD",
      "price": "0.001",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": "0.10",
        "priceCurrency": "USD",
        "unitText": "GB-month"
      },
      "availability": "https://schema.org/InStock",
      "url": "${o}"
    }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How do I store AI Agent memory without pinning it to IPFS?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Use Tack's private object endpoint. Send the bytes to POST /private/objects, sign the EIP-3009 authorization over x402 or attach an MPP credential, and the object is stored on Tack's private volume scoped to the paying wallet. No CID is ever emitted, no IPFS gateway will serve it, and only the owning wallet can read it back through the API."
        }
      },
      {
        "@type": "Question",
        "name": "What is the cheapest IPFS pinning service for AI Agents?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Tack settles at roughly $0.10 per GB-month when measured against Pinata's published x402 demo, which fixes 12 months as the only term. Tack lets the Agent pick anywhere from 1 to 24 months, so for a typical short pin Tack is approximately 12 times cheaper. Pricing is per-pin, paid in USDC, no subscriptions."
        }
      },
      {
        "@type": "Question",
        "name": "How does x402 work for AI Agent payments?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "x402 is the HTTP 402 Payment Required flow paired with EIP-3009 transferWithAuthorization. The Agent posts to a paid endpoint, the server returns 402 with a price quote, the Agent's wallet signs the transferWithAuthorization once, and the server resubmits the request with the signed payment header. A facilitator settles the USDC transfer on whichever chain the wallet already holds funds on. No gas is required from the Agent and no separate billing account is needed."
        }
      },
      {
        "@type": "Question",
        "name": "What is a Pinata alternative for AI Agents?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Tack is built specifically for AI Agents, with wallet-based identity instead of email plus API key, per-pin USDC payment instead of a $20 monthly minimum, an A2A agent card at the well-known URL, and a private storage track for state the Agent does not want pinned. The full IPFS Pinning Service API spec is supported so any existing Pinata integration ports across."
        }
      },
      {
        "@type": "Question",
        "name": "Where should AI Agents store private data that should not be public?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "On Tack's private object track. Bytes live on Tack's private volume, never pinned to IPFS, addressable only by a random object id that the paying wallet owns. Requests without a bearer token get a 401, and another wallet's valid token gets a 404 (not a 403), so the existence of the object is itself not leaked to anyone but the owner."
        }
      },
      {
        "@type": "Question",
        "name": "Is Tack's private storage end-to-end encrypted?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Private here means access-gated by wallet, not end-to-end encrypted. Bytes sit on Tack's volume in plaintext at rest. Tack can technically read them, only the owning wallet can read them through the API. If a use case needs confidentiality from the operator, encrypt client-side before upload and let the wallet remain the access boundary."
        }
      },
      {
        "@type": "Question",
        "name": "How does an Agent retrieve content it pinned to Tack?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "For public pins, fetch from the public gateway at GET /ipfs/<cid>. For private objects, send GET /private/objects/<obj_id>/content with the bearer token returned at payment, or sign back in with SIWE at /auth/challenge and /auth/token if the original token has expired."
        }
      },
      {
        "@type": "Question",
        "name": "What chains does Tack support?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "USDC settlement on Taiko (chain id 167000) and Base (chain id 8453) via x402, and USDC.e on Tempo (chain id 4217) via MPP. The Agent's wallet picks whichever rail it already holds funds on. No bridging required."
        }
      },
      {
        "@type": "Question",
        "name": "Does Tack work with Claude Code, Codex, OpenClaw, or Hermes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. The full IPFS Pinning Service API spec is supported plus an A2A agent card published at /.well-known/agent.json. Any HTTP client an Agent uses works. No SDK is required, no platform-specific adapter, and no API key beyond the wallet signature."
        }
      }
    ]
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap" />

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XVDW4HDR11"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-XVDW4HDR11');
  </script>

  <style>
    :root {
      --accent:  #ff1566;
      --bg:      #0a0a0a;
      --bg2:     #111111;
      --fg:      #f0ede4;
      --fg-dim:  rgba(240,237,228,0.72);
      --fg-mute: rgba(240,237,228,0.50);
      --line:    rgba(240,237,228,0.10);
      --line-2:  rgba(240,237,228,0.16);
      --f-display: 'Barlow Condensed', ui-sans-serif, system-ui, sans-serif;
      --f-mono:    'IBM Plex Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
    ::selection { background: var(--accent); color: #fff; }

    html, body { background: var(--bg); }
    body {
      font-family: var(--f-mono);
      font-weight: 400;
      color: var(--fg);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      line-height: 1.5;
      font-size: 14px;
      overflow-x: hidden;
    }

    a { color: inherit; text-decoration: none; }
    button { font-family: inherit; cursor: pointer; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

    code, .mono { font-family: var(--f-mono); }
    em { font-style: italic; color: var(--accent); font-weight: 900; }

    /* Display utility */
    .display {
      font-family: var(--f-display);
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.025em;
      line-height: 0.88;
      color: var(--fg);
    }

    /* Eyebrow / label utility */
    .eyebrow {
      font-family: var(--f-mono);
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--accent);
    }
    .meta {
      font-family: var(--f-mono);
      font-size: 11px;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--fg-mute);
    }
    .meta b { color: var(--fg-dim); font-weight: 500; }

    /* ── Nav ── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: var(--bg);
      border-bottom: 1px solid var(--line);
    }
    .nav-inner {
      display: flex; align-items: center; justify-content: space-between;
      height: 56px;
      padding: 0 40px;
    }
    @media (max-width: 720px) { .nav-inner { padding: 0 20px; } }
    .logo {
      display: inline-flex; align-items: baseline; gap: 2px;
      font-family: var(--f-mono);
      font-weight: 500; font-size: 15px;
      color: var(--fg);
    }
    .logo .slash { color: var(--accent); }
    .nav-links {
      display: flex; align-items: center; gap: 28px;
      font-family: var(--f-mono);
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }
    .nav-links a { color: var(--fg-dim); transition: color 0.12s; }
    .nav-links a:hover { color: var(--fg); }
    .nav-links .nav-cta {
      color: #fff;
      background: var(--accent);
      padding: 9px 14px;
      letter-spacing: 0.18em;
      font-weight: 700;
    }
    .nav-links .nav-cta:hover { color: #fff; }
    @media (max-width: 860px) {
      .nav-links a:not(.nav-cta) { display: none; }
    }

    /* ── Layout ── */
    main { padding-top: 56px; position: relative; z-index: 1; }
    section { padding: 96px 40px; position: relative; }
    @media (max-width: 720px) { section { padding: 64px 20px; } }
    .section-head { display: flex; flex-direction: column; gap: 28px; margin-bottom: 56px; }
    h2.section-title {
      font-family: var(--f-display);
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.025em;
      line-height: 0.88;
      color: var(--fg);
      font-size: clamp(64px, 9.5vw, 148px);
      max-width: 22ch;
    }
    .section-intro {
      font-family: var(--f-mono);
      font-weight: 400;
      font-size: 15px;
      color: var(--fg-dim);
      line-height: 1.6;
      max-width: 68ch;
      margin-top: 18px;
    }
    .section-intro strong { color: var(--fg); font-weight: 500; }
    .accent-section .section-intro { color: rgba(255,255,255,0.92); }
    .accent-section .section-intro strong { color: #fff; }

    /* ── Buttons ── */
    .btn-fill {
      background: var(--accent);
      color: #fff;
      font-family: var(--f-mono);
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      padding: 13px 22px;
      border: 0;
      display: inline-flex; align-items: center; gap: 10px;
      transition: opacity 0.12s, transform 0.06s;
    }
    .btn-fill:hover { opacity: 0.85; }
    .btn-fill:active { transform: translateY(1px); }
    .btn-ghost {
      background: transparent;
      color: var(--fg);
      font-family: var(--f-mono);
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      padding: 12px 21px;
      border: 1px solid var(--line);
      display: inline-flex; align-items: center; gap: 10px;
      transition: border-color 0.12s;
    }
    .btn-ghost:hover { border-color: var(--fg); }

    /* ── Hero ── */
    .hero {
      padding: 64px 40px 0;
    }
    @media (max-width: 720px) { .hero { padding: 32px 20px 0; } }
    .hero-meta {
      display: flex; align-items: center; gap: 14px;
      padding-bottom: 28px;
      flex-wrap: wrap;
    }
    .hero-meta .live {
      display: inline-flex; align-items: center; gap: 8px;
      color: var(--accent);
    }
    .hero-meta .live-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 0 4px rgba(255, 21, 102, 0.18);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.55; transform: scale(0.85); }
    }
    .hero-headline {
      font-family: var(--f-display);
      font-weight: 900;
      text-transform: uppercase;
      color: var(--fg);
      font-size: clamp(72px, 13vw, 200px);
      line-height: 0.84;
      letter-spacing: -0.035em;
      margin: 0 0 0 0;
      padding-bottom: 8px;
      max-width: 14ch;
    }
    .hero-headline em { font-style: italic; color: var(--accent); font-weight: 900; }
    .hero-headline .dot { color: var(--accent); }
    .hero-split {
      display: grid;
      grid-template-columns: 1fr;
      gap: 40px;
      border-top: 2px solid var(--fg);
      padding-top: 40px;
      margin-top: -8px;
    }
    @media (min-width: 960px) {
      .hero-split { grid-template-columns: 1.4fr 0.9fr; gap: 80px; }
    }
    .hero-lede {
      font-family: var(--f-mono);
      font-weight: 300;
      font-size: clamp(15px, 1.4vw, 17px);
      line-height: 1.55;
      color: var(--fg);
      max-width: 56ch;
      margin-bottom: 28px;
    }
    .hero-lede strong { color: var(--accent); font-weight: 500; }

    .hero-endpoints {
      display: flex; flex-direction: column; gap: 0;
      border: 1px solid var(--line);
      margin-bottom: 28px;
    }
    .endpoint-row {
      display: grid;
      grid-template-columns: 64px 1fr auto auto;
      align-items: stretch;
      border-bottom: 1px solid var(--line);
    }
    .endpoint-row:last-child { border-bottom: 0; }
    .endpoint-row .method {
      background: var(--accent);
      color: #fff;
      font-family: var(--f-mono);
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      display: flex; align-items: center; justify-content: center;
    }
    .endpoint-row .url {
      font-family: var(--f-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--fg);
      padding: 13px 16px;
      letter-spacing: -0.01em;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .endpoint-row .meta-cell {
      font-family: var(--f-mono);
      font-size: 11px;
      color: var(--fg-mute);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      display: flex; align-items: center;
      padding: 0 16px;
      border-left: 1px solid var(--line);
    }
    .endpoint-row .copy-btn {
      background: transparent;
      border: 0;
      border-left: 1px solid var(--line);
      color: var(--fg-dim);
      width: 48px;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.12s, background 0.12s;
    }
    .endpoint-row .copy-btn:hover { color: var(--fg); background: rgba(240,237,228,0.04); }
    .endpoint-row .copy-btn.copied { color: var(--accent); }
    .endpoint-row .copy-btn svg { width: 14px; height: 14px; }

    .hero-cta {
      display: flex; gap: 10px; flex-wrap: wrap;
    }

    .hero-stats {
      display: grid;
      grid-template-columns: 1fr;
      gap: 28px;
    }
    .hero-stat { display: flex; flex-direction: column; gap: 6px; }
    .hero-stat-label {
      font-family: var(--f-mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--fg-mute);
    }
    .hero-stat-value {
      font-family: var(--f-display);
      font-weight: 900;
      font-size: clamp(56px, 7vw, 80px);
      line-height: 0.88;
      letter-spacing: -0.025em;
      color: var(--accent);
    }
    .hero-stat-unit {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--fg-dim);
      margin-top: 2px;
    }

    /* ── Marquee ── */
    .marquee {
      background: var(--bg);
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      overflow: hidden;
      padding: 16px 0;
    }
    .marquee-track {
      display: flex; gap: 48px;
      width: max-content;
      animation: marq 60s linear infinite;
      font-family: var(--f-mono);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--fg-mute);
    }
    .marquee.rev .marquee-track { animation-direction: reverse; }
    .marquee-track span { display: inline-flex; align-items: center; gap: 48px; }
    .marquee-track span::after {
      content: '·';
      color: var(--accent);
      margin-left: 48px;
    }
    @keyframes marq {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }

    /* ── Compare table ── */
    .compare {
      display: grid;
      grid-template-columns: 185px 1fr 1fr;
      border-top: 2px solid var(--fg);
    }
    @media (max-width: 720px) {
      .compare { grid-template-columns: 110px 1fr 1fr; }
    }
    .compare > div {
      padding: 22px 16px;
      border-bottom: 1px solid var(--line);
      font-family: var(--f-mono);
      font-size: 14px;
      line-height: 1.45;
    }
    .compare .ck {
      color: var(--fg-mute);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      align-self: center;
    }
    .compare .c-head {
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      border-bottom: 2px solid var(--fg);
    }
    .compare .c-head.c-legacy { color: var(--fg-dim); }
    .compare .c-head.c-tack { color: var(--accent); }
    .compare .c-legacy { color: var(--fg-dim); }
    .compare .c-legacy .strike { color: var(--accent); text-decoration: line-through; text-decoration-color: var(--accent); }
    .compare .c-tack { color: var(--fg); font-weight: 500; }

    /* ── Two-track / dual list ── */
    .tracks {
      display: grid;
      grid-template-columns: 1fr;
      border-top: 2px solid var(--fg);
    }
    @media (min-width: 960px) {
      .tracks { grid-template-columns: 1fr 1fr; }
    }
    .track {
      padding: 32px 0 0;
    }
    .track + .track { border-top: 1px solid var(--line); }
    @media (min-width: 960px) {
      .track + .track { border-top: 0; border-left: 1px solid var(--line); padding-left: 40px; }
      .track:first-child { padding-right: 40px; }
    }
    .track-tag {
      font-family: var(--f-mono);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--accent);
      margin-bottom: 10px;
    }
    .track-tag.muted { color: var(--fg-dim); }
    .track-sub {
      font-family: var(--f-mono);
      font-size: 12px;
      color: var(--fg-mute);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      margin-bottom: 32px;
    }
    .track-list { list-style: none; }
    .track-list li {
      padding: 22px 0;
      border-top: 1px solid var(--line);
      display: grid;
      grid-template-columns: 40px 1fr;
      gap: 18px;
      align-items: baseline;
    }
    .track-list li:last-child { border-bottom: 1px solid var(--line); }
    .track-list .ord {
      font-family: var(--f-mono);
      font-size: 12px;
      letter-spacing: 0.14em;
      color: var(--fg-mute);
    }
    .track-list .name {
      font-family: var(--f-display);
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.015em;
      font-size: 28px;
      color: var(--fg);
      line-height: 1;
      margin-bottom: 6px;
    }
    .track-list .desc {
      font-family: var(--f-mono);
      font-size: 13px;
      color: var(--fg-dim);
      line-height: 1.55;
      grid-column: 2;
    }

    /* ── Flow ── */
    .flow-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
      border-top: 2px solid var(--fg);
    }
    @media (min-width: 960px) {
      .flow-grid { grid-template-columns: 1fr 1fr; }
    }
    .flow-col { padding: 32px 0 0; }
    .flow-col + .flow-col { border-top: 1px solid var(--line); }
    @media (min-width: 960px) {
      .flow-col + .flow-col { border-top: 0; border-left: 1px solid var(--line); padding-left: 40px; }
      .flow-col:first-child { padding-right: 40px; }
    }
    .flow-steps { list-style: none; margin-top: 24px; }
    .flow-steps li {
      padding: 22px 0;
      border-top: 1px solid var(--line);
      display: grid;
      grid-template-columns: 76px 1fr;
      gap: 18px;
      align-items: start;
    }
    .flow-steps li:last-child { border-bottom: 1px solid var(--line); }
    .flow-steps .ord {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 700;
    }
    .flow-steps .step {
      font-family: var(--f-mono);
      font-size: 14px;
      color: var(--fg);
      line-height: 1.5;
    }
    .flow-steps .step code {
      background: var(--bg2);
      border: 1px solid var(--line);
      padding: 1px 6px;
      color: var(--accent);
      font-size: 12px;
    }

    /* ── Code (Dockets) ── */
    .integrate { display: grid; grid-template-columns: 1fr; gap: 32px; }
    @media (min-width: 1100px) {
      .integrate { grid-template-columns: 0.7fr 1.3fr; gap: 40px; align-items: start; }
    }
    .integrate-aside {
      border: 1px solid var(--line);
      padding: 0;
      background: var(--bg2);
    }
    @media (min-width: 1100px) {
      .integrate-aside { position: sticky; top: 72px; }
    }
    .integrate-aside .label {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--fg-mute);
      padding: 18px 24px 14px;
      border-bottom: 1px solid var(--line);
      display: block;
    }
    .integrate-aside .url {
      font-family: var(--f-mono);
      font-size: 17px;
      color: var(--fg);
      letter-spacing: -0.01em;
      word-break: break-all;
      padding: 18px 24px;
      border-bottom: 1px solid var(--line);
      background: var(--bg);
      margin: 0;
    }
    .integrate-aside .url .host { color: var(--accent); }
    .integrate-aside > .note,
    .integrate-aside > .check,
    .integrate-aside > .chips { padding-left: 24px; padding-right: 24px; }
    .integrate-aside > .note { padding-top: 18px; padding-bottom: 18px; }
    .integrate-aside > .check { padding-top: 18px; padding-bottom: 18px; }
    .integrate-aside > .chips { padding-bottom: 24px; }
    .integrate-aside .note {
      font-family: var(--f-mono);
      font-size: 13px;
      color: var(--fg-dim);
      line-height: 1.55;
      margin: 0;
    }
    .integrate-aside .check {
      list-style: none;
      display: flex; flex-direction: column; gap: 10px;
      border-top: 1px solid var(--line);
      margin: 0;
    }
    .integrate-aside .check li {
      display: flex; gap: 12px; align-items: flex-start;
      font-family: var(--f-mono);
      font-size: 13px;
      color: var(--fg);
    }
    .integrate-aside .check li::before {
      content: '+';
      color: var(--accent);
      font-weight: 700;
      flex-shrink: 0;
    }
    .integrate-aside .chips {
      display: flex; gap: 6px; flex-wrap: wrap;
      border-top: 1px solid var(--line);
      padding-top: 18px;
      margin: 0;
    }
    .integrate-aside .chip {
      font-family: var(--f-mono);
      font-size: 10.5px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--fg-dim);
      padding: 6px 10px;
      border: 1px solid var(--line);
    }
    .integrate-aside .chip strong { color: var(--accent); font-weight: 700; }

    .code-stack { display: flex; flex-direction: column; gap: 28px; min-width: 0; }
    .code-block {
      border: 1px solid var(--line);
      background: var(--bg2);
      position: relative;
    }
    .code-track-head {
      display: grid;
      grid-template-columns: 56px 1fr auto;
      align-items: stretch;
      border-bottom: 1px solid var(--line);
    }
    .code-track-head .idx {
      background: var(--accent);
      color: #fff;
      font-family: var(--f-display);
      font-weight: 900;
      font-size: 32px;
      line-height: 1;
      display: flex; align-items: center; justify-content: center;
      letter-spacing: -0.02em;
    }
    .code-track-head .label-wrap {
      display: flex; flex-direction: column; justify-content: center;
      padding: 12px 18px;
      gap: 4px;
    }
    .code-track-head .label {
      font-family: var(--f-display);
      font-weight: 900;
      font-size: 22px;
      letter-spacing: -0.015em;
      text-transform: uppercase;
      color: var(--fg);
      line-height: 1;
    }
    .code-track-head .path {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .code-track-head .verb {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--fg-mute);
      padding: 0 18px;
      display: flex; align-items: center;
      border-left: 1px solid var(--line);
    }
    .code-tabs {
      display: flex; gap: 0;
      border-bottom: 1px solid var(--line);
      overflow-x: auto;
      background: var(--bg);
    }
    .code-tabs::-webkit-scrollbar { display: none; }
    .code-tab {
      background: transparent;
      border: 0;
      padding: 14px 18px;
      font-family: var(--f-mono);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--fg-mute);
      cursor: pointer;
      border-right: 1px solid var(--line);
      border-top: 2px solid transparent;
      transition: color 0.12s, background 0.12s, border-color 0.12s;
      position: relative;
    }
    .code-tab:hover { color: var(--fg); }
    .code-tab[aria-selected="true"] {
      color: var(--accent);
      background: var(--bg2);
      border-top-color: var(--accent);
    }
    .code-pane { display: none; }
    .code-pane[data-active="true"] { display: block; }
    .code-block pre {
      padding: 24px 28px;
      overflow-x: auto;
      font-family: var(--f-mono);
      font-size: 12.5px;
      line-height: 1.75;
      color: var(--fg);
    }
    .code-track-foot {
      display: flex; gap: 0;
      border-top: 1px solid var(--line);
      background: var(--bg);
    }
    .code-track-foot .meta {
      padding: 10px 14px;
      font-family: var(--f-mono);
      font-size: 10.5px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--fg-mute);
      border-right: 1px solid var(--line);
    }
    .code-track-foot .meta b { color: var(--fg-dim); font-weight: 500; }
    .code-track-foot .meta:last-child { border-right: 0; }
    .code-track-foot .meta.accent { color: var(--accent); }
    .code-block pre .k { color: var(--accent); }
    .code-block pre .s { color: var(--fg); }
    .code-block pre .c { color: var(--fg-mute); }
    .code-block pre .f { color: var(--fg); font-weight: 500; }
    .code-block pre .n { color: var(--accent); }

    /* ── Rails ── */
    .rails {
      display: grid;
      grid-template-columns: 1fr;
      border-top: 2px solid var(--fg);
    }
    @media (min-width: 960px) { .rails { grid-template-columns: 1fr 1fr; } }
    .rail {
      padding: 32px 0;
    }
    .rail + .rail { border-top: 1px solid var(--line); }
    @media (min-width: 960px) {
      .rail + .rail { border-top: 0; border-left: 1px solid var(--line); padding-left: 40px; }
      .rail:first-child { padding-right: 40px; }
    }
    .rail-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .rail-name {
      font-family: var(--f-display);
      font-weight: 900;
      text-transform: uppercase;
      font-size: 56px;
      line-height: 1;
      letter-spacing: -0.02em;
      color: var(--fg);
    }
    .rail-chains { display: inline-flex; gap: 6px; flex-wrap: wrap; }
    .rail-chip {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
      padding: 4px 9px;
      border: 1px solid var(--line);
    }
    .rail-blurb {
      font-family: var(--f-mono);
      font-size: 13px;
      color: var(--fg-dim);
      line-height: 1.55;
      margin-bottom: 22px;
    }
    .rail-blurb code { background: var(--bg2); border: 1px solid var(--line); padding: 1px 6px; color: var(--fg); }
    .rail-spec { display: grid; gap: 0; border-top: 1px solid var(--line); }
    .rail-spec-row {
      display: grid;
      grid-template-columns: 110px 1fr;
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
      font-family: var(--f-mono);
      font-size: 12px;
      align-items: baseline;
    }
    .rail-spec-row:last-child { border-bottom: 0; }
    .rail-spec-k {
      color: var(--fg-mute);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 11px;
    }
    .rail-spec-v { color: var(--fg); word-break: break-all; }
    .rail-spec-v .accent { color: var(--accent); }

    /* ── Pricing fare table ── */
    .fare {
      display: grid;
      grid-template-columns: 1fr;
      border: 1px solid var(--line);
    }
    @media (min-width: 960px) { .fare { grid-template-columns: 1fr 1fr 1fr; } }
    .fare-col {
      padding: 32px;
      border-bottom: 1px solid var(--line);
    }
    .fare-col:last-child { border-bottom: 0; }
    @media (min-width: 960px) {
      .fare-col { border-bottom: 0; border-right: 1px solid var(--line); }
      .fare-col:last-child { border-right: 0; }
    }
    .fare-col.hot {
      background: var(--accent);
      color: #fff;
    }
    .fare-col.hot .fare-label,
    .fare-col.hot .fare-price,
    .fare-col.hot .fare-unit,
    .fare-col.hot .fare-list { color: #fff; }
    .fare-col.hot .fare-list li { border-color: rgba(0,0,0,0.18); }
    .fare-col.hot .fare-list li .v { color: rgba(0,0,0,0.6); }
    .fare-label {
      font-family: var(--f-mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--fg-mute);
      margin-bottom: 12px;
    }
    .fare-price {
      font-family: var(--f-display);
      font-weight: 900;
      font-size: clamp(72px, 9vw, 104px);
      line-height: 0.88;
      letter-spacing: -0.025em;
      color: var(--accent);
    }
    .fare-unit {
      font-family: var(--f-mono);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--fg-mute);
      margin: 8px 0 22px;
    }
    .fare-list { list-style: none; margin-top: 14px; }
    .fare-list li {
      display: flex; justify-content: space-between; gap: 14px;
      padding: 10px 0;
      border-top: 1px solid var(--line);
      font-family: var(--f-mono);
      font-size: 12px;
      color: var(--fg);
    }
    .fare-list li .k { color: var(--fg-dim); text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; }
    .fare-list li .v { font-weight: 500; }
    .fare-footnote {
      font-family: var(--f-mono);
      font-size: 12px;
      color: var(--fg-mute);
      line-height: 1.55;
      margin: 24px 0 0;
      max-width: 88ch;
    }
    .fare-footnote a { color: var(--accent); border-bottom: 1px solid var(--accent); }

    /* Pricing tool */
    .price-tool {
      display: grid;
      grid-template-columns: 1fr;
      border-top: 2px solid var(--fg);
      margin-top: 56px;
    }
    @media (min-width: 960px) { .price-tool { grid-template-columns: 1.2fr 0.8fr; } }
    .price-tool-left { padding: 40px 0; padding-right: 40px; }
    .price-tool-right {
      padding: 40px 0 40px 40px;
      border-top: 1px solid var(--line);
    }
    @media (min-width: 960px) {
      .price-tool-right { border-top: 0; border-left: 1px solid var(--line); }
    }
    .price-eyebrow {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--fg-mute);
      margin-bottom: 14px;
    }
    .price-live {
      font-family: var(--f-display);
      font-weight: 900;
      font-size: clamp(72px, 10vw, 144px);
      line-height: 0.88;
      letter-spacing: -0.03em;
      color: var(--fg);
    }
    .price-live .currency { color: var(--accent); }
    .price-sub {
      font-family: var(--f-mono);
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--fg-dim);
      margin: 12px 0 36px;
    }
    .slider-group { margin-bottom: 24px; }
    .slider-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .slider-label {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--fg-mute);
    }
    .slider-val {
      font-family: var(--f-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--fg);
    }
    .slider-val .unit { color: var(--fg-mute); margin-left: 4px; }
    input[type="range"].tick-slider {
      -webkit-appearance: none; appearance: none;
      width: 100%;
      height: 2px;
      background: var(--line-2);
      border: 0;
      outline: none;
    }
    input[type="range"].tick-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 14px; height: 14px;
      background: var(--accent);
      border: 0;
      border-radius: 50%;
      cursor: pointer;
    }
    input[type="range"].tick-slider::-moz-range-thumb {
      width: 14px; height: 14px;
      background: var(--accent);
      border: 0;
      border-radius: 50%;
      cursor: pointer;
    }

    .price-facts { list-style: none; display: flex; flex-direction: column; gap: 14px; }
    .price-facts li {
      font-family: var(--f-mono);
      font-size: 13px;
      color: var(--fg);
      line-height: 1.5;
      display: flex; gap: 12px;
    }
    .price-facts li::before {
      content: '+';
      color: var(--accent);
      font-weight: 700;
      flex-shrink: 0;
    }
    .price-facts code { background: var(--bg2); border: 1px solid var(--line); padding: 1px 6px; color: var(--fg); }

    /* ── API grid ── */
    .api-group-head {
      display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
      margin: 0 0 18px;
    }
    .api-group-head.second { margin-top: 56px; }
    .api-grid {
      display: grid;
      grid-template-columns: 1fr;
      border-top: 2px solid var(--fg);
    }
    @media (min-width: 960px) { .api-grid { grid-template-columns: 1fr 1fr; } }
    .api-row {
      display: grid;
      grid-template-columns: 76px 1fr auto;
      gap: 16px;
      padding: 18px 16px;
      border-bottom: 1px solid var(--line);
      align-items: center;
    }
    @media (min-width: 960px) {
      .api-row:nth-child(odd) { border-right: 1px solid var(--line); }
    }
    .api-method {
      font-family: var(--f-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      padding: 5px 8px;
      text-align: center;
      color: #fff;
      background: var(--accent);
    }
    .api-method.get    { background: transparent; color: var(--fg); border: 1px solid var(--line); }
    .api-method.delete { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
    .api-method.patch  { background: transparent; color: var(--fg-dim); border: 1px solid var(--line); }
    .api-path {
      font-family: var(--f-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--fg);
      letter-spacing: -0.01em;
    }
    .api-desc {
      font-family: var(--f-mono);
      font-size: 12px;
      color: var(--fg-dim);
      margin-top: 4px;
      line-height: 1.45;
    }
    .api-tag {
      font-family: var(--f-mono);
      font-size: 10.5px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      padding: 4px 8px;
      border: 1px solid var(--line);
      color: var(--fg-dim);
      white-space: nowrap;
    }
    .api-tag.pay { color: var(--accent); border-color: var(--accent); }

    /* ── Full-bleed accent (IR) ── */
    .accent-section {
      background: var(--accent);
      color: #fff;
      padding: 96px 40px;
    }
    @media (max-width: 720px) { .accent-section { padding: 64px 20px; } }
    .accent-section .eyebrow { color: rgba(255,255,255,0.85); }
    .accent-section h2.section-title { color: #fff; }
    .accent-section h2.section-title em { color: rgba(0,0,0,0.42); font-style: italic; }
    .accent-section .ir-body p {
      font-family: var(--f-mono);
      font-size: 15px;
      color: rgba(255,255,255,0.92);
      line-height: 1.55;
      max-width: 64ch;
    }
    .accent-section .ir-body { display: flex; flex-direction: column; gap: 18px; }
    .accent-section .ir-cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
      margin-top: 40px;
      border-top: 2px solid rgba(0,0,0,0.35);
    }
    @media (min-width: 880px) { .accent-section .ir-cards { grid-template-columns: 1fr 1fr; } }
    .accent-section .ir-card {
      background: rgba(0,0,0,0.20);
      padding: 28px;
      border-bottom: 1px solid rgba(0,0,0,0.35);
    }
    @media (min-width: 880px) {
      .accent-section .ir-card:nth-child(odd) { border-right: 1px solid rgba(0,0,0,0.35); }
    }
    .accent-section .ir-card .res {
      font-family: var(--f-display);
      font-weight: 900;
      font-size: 44px;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      color: #fff;
      margin-bottom: 8px;
    }
    .accent-section .ir-card .role {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(0,0,0,0.5);
      margin-bottom: 12px;
    }
    .accent-section .ir-card .desc {
      font-family: var(--f-mono);
      font-size: 13px;
      color: rgba(255,255,255,0.9);
      line-height: 1.55;
    }
    .accent-section .ir-link {
      display: inline-flex; align-items: center; gap: 10px;
      margin-top: 28px;
      padding: 13px 22px;
      border: 1px solid #fff;
      color: #fff;
      font-family: var(--f-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .accent-section .ir-link:hover { background: rgba(0,0,0,0.18); }

    /* ── FAQ grid ── */
    .faq {
      border-top: 2px solid var(--fg);
    }
    .faq-row {
      display: grid;
      grid-template-columns: 60px minmax(180px, 1fr) 1.4fr;
      gap: 24px;
      padding: 28px 0;
      border-bottom: 1px solid var(--line);
      align-items: start;
    }
    @media (max-width: 880px) {
      .faq-row { grid-template-columns: 40px 1fr; gap: 16px; }
      .faq-row .faq-a { grid-column: 2; }
    }
    .faq-num {
      font-family: var(--f-display);
      font-weight: 900;
      font-size: 36px;
      line-height: 1;
      letter-spacing: -0.02em;
      color: var(--accent);
    }
    .faq-q {
      font-family: var(--f-display);
      font-weight: 900;
      font-size: clamp(24px, 2.6vw, 34px);
      line-height: 1.05;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: var(--fg);
    }
    .faq-a {
      font-family: var(--f-mono);
      font-size: 13px;
      line-height: 1.6;
      color: var(--fg-dim);
    }
    .faq-a code { background: var(--bg2); border: 1px solid var(--line); padding: 1px 6px; color: var(--fg); }

    /* ── Closer ── */
    .closer {
      border-top: 2px solid var(--fg);
      padding: 96px 40px 64px;
    }
    @media (max-width: 720px) { .closer { padding: 64px 20px 48px; } }
    .closer-word {
      font-family: var(--f-display);
      font-weight: 900;
      text-transform: uppercase;
      font-size: clamp(120px, 22vw, 296px);
      line-height: 0.82;
      letter-spacing: -0.04em;
      color: var(--fg);
      margin: 28px 0 40px;
    }
    .closer-word em { font-style: italic; color: var(--accent); font-weight: 900; }
    .closer-headline {
      font-family: var(--f-display);
      font-weight: 900;
      text-transform: uppercase;
      font-size: clamp(64px, 8vw, 124px);
      line-height: 0.88;
      letter-spacing: -0.03em;
      color: var(--fg);
      margin: 0 0 40px;
      max-width: 22ch;
    }
    .closer-headline .dot { color: var(--accent); }
    .closer-foot {
      display: flex; flex-direction: column; gap: 32px;
      border-top: 1px solid var(--line);
      padding-top: 32px;
    }
    @media (min-width: 960px) {
      .closer-foot { flex-direction: row; align-items: flex-end; justify-content: space-between; }
    }
    .closer-body {
      font-family: var(--f-mono);
      font-size: 15px;
      line-height: 1.55;
      color: var(--fg-dim);
      max-width: 52ch;
    }
    .closer-cta { display: flex; gap: 10px; flex-wrap: wrap; }
    .closer-trust {
      display: flex; gap: 24px; flex-wrap: wrap;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid var(--line);
    }
    .closer-trust-item {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--fg-dim);
    }
    .closer-trust-item b { color: var(--fg); font-weight: 700; }

    /* ── Footer ── */
    footer { padding: 32px 40px; border-top: 1px solid var(--line); }
    @media (max-width: 720px) { footer { padding: 24px 20px; } }
    .footer-inner { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; }
    .footer-links { display: flex; gap: 24px; }
    .footer-links a {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--fg-mute);
    }
    .footer-links a:hover { color: var(--fg); }
    .footer-tag {
      font-family: var(--f-mono);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--fg-mute);
    }
  </style>
</head>
<body>

  <nav>
    <div class="nav-inner">
      <a class="logo" href="#top" aria-label="Tack home">
        <span class="slash">/</span><span>tack</span>
      </a>
      <div class="nav-links">
        <a href="#keep">keep</a>
        <a href="#pricing">pricing</a>
        <a href="#api">api</a>
        <a href="#faq">faq</a>
        <a href="#integrate" class="nav-cta">point your agent →</a>
      </div>
    </div>
  </nav>

  <main id="top">

    <section class="hero">
      <div class="hero-meta meta">
        <span class="live"><span class="live-dot" aria-hidden="true"></span>LIVE</span>
        <span>·</span>
        <span>Taiko</span>
        <span>·</span>
        <span>Base</span>
        <span>·</span>
        <span>Tempo</span>
      </div>
      <h1 class="hero-headline">A place for an Agent's <em>own</em> things<span class="dot">.</span></h1>

      <div class="hero-split">
        <div>
          <p class="hero-lede">
            Tack pins what your Agent wants the world to find, and stores what only the paying wallet should read. Two tracks, same wallet, same x402 and MPP rails, no signup and no API keys.
          </p>

          <div class="hero-endpoints">
            <div class="endpoint-row">
              <span class="method">POST</span>
              <span class="url">${o}/pins</span>
              <span class="meta-cell">pin · public</span>
              <button class="copy-btn" data-copy="${o}/pins" aria-label="Copy /pins endpoint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            <div class="endpoint-row">
              <span class="method">POST</span>
              <span class="url">${o}/private/objects</span>
              <span class="meta-cell">obj · private</span>
              <button class="copy-btn" data-copy="${o}/private/objects" aria-label="Copy /private/objects endpoint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="hero-cta">
            <a href="#integrate" class="btn-fill">Point your agent →</a>
            <a href="#pricing" class="btn-ghost">Try the pricing</a>
          </div>
        </div>

        <div class="hero-stats" aria-label="Stats">
          <div class="hero-stat">
            <div class="hero-stat-label">Pin</div>
            <div class="hero-stat-value">$0.001</div>
            <div class="hero-stat-unit">/ pin</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-label">Private</div>
            <div class="hero-stat-value">$0.0010</div>
            <div class="hero-stat-unit">/ 5MB / 1mo</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-label">Settlement</div>
            <div class="hero-stat-value">~30s</div>
            <div class="hero-stat-unit">&nbsp;</div>
          </div>
        </div>
      </div>
    </section>

    <div class="marquee" aria-hidden="true">
      <div class="marquee-track">
        <span>Works with Claude Code</span>
        <span>Works with Codex</span>
        <span>Works with OpenClaw</span>
        <span>Works with Hermes</span>
        <span>Works with any HTTP client</span>
        <span>IPFS Pinning Service spec</span>
        <span>A2A agent card</span>
        <span>x402 · EIP-3009</span>
        <span>MPP · TIP-20</span>
        <span>USDC settlement</span>
        <span>Works with Claude Code</span>
        <span>Works with Codex</span>
        <span>Works with OpenClaw</span>
        <span>Works with Hermes</span>
        <span>Works with any HTTP client</span>
        <span>IPFS Pinning Service spec</span>
        <span>A2A agent card</span>
        <span>x402 · EIP-3009</span>
        <span>MPP · TIP-20</span>
        <span>USDC settlement</span>
      </div>
    </div>

    <section id="problem">
      <div class="section-head">
        <div class="eyebrow">§ 01 · Problem</div>
        <h2 class="section-title">Pin services were built for humans. <em>Agents</em> need different defaults.</h2>
      </div>

      <div class="compare">
        <div class="c-head ck">&nbsp;</div>
        <div class="c-head c-legacy">Pinata · NFT.Storage · Storacha</div>
        <div class="c-head c-tack">Tack</div>

        <div class="ck">Identity</div>
        <div class="c-legacy"><span class="strike">Email + API key</span></div>
        <div class="c-tack">Wallet address</div>

        <div class="ck">Payment</div>
        <div class="c-legacy"><span class="strike">Credit card, monthly plan</span></div>
        <div class="c-tack">On-chain USDC, per pin</div>

        <div class="ck">Minimum</div>
        <div class="c-legacy"><span class="strike">$20 / month</span></div>
        <div class="c-tack">$0.001 / pin</div>

        <div class="ck">Machine-native</div>
        <div class="c-legacy"><span class="strike">—</span></div>
        <div class="c-tack">HTTP 402 + A2A agent card</div>
      </div>
    </section>

    <section id="keep">
      <div class="section-head">
        <div class="eyebrow">§ 02 · What to keep</div>
        <h2 class="section-title">The two kinds of things an <em>Agent</em> produces.</h2>
      </div>

      <div class="tracks">
        <div class="track">
          <div class="track-tag">To pin</div>
          <div class="track-sub">public, addressable by CID</div>
          <ol class="track-list">
            <li><span class="ord">01</span><div><div class="name">Generated artifacts</div><div class="desc">Images, PDFs, code bundles, video.</div></div></li>
            <li><span class="ord">02</span><div><div class="name">RAG corpora</div><div class="desc">Shared knowledge across an Agent fleet.</div></div></li>
            <li><span class="ord">03</span><div><div class="name">Replayable outputs</div><div class="desc">Cache deterministic tool calls and skip the work if the CID resolves.</div></div></li>
            <li><span class="ord">04</span><div><div class="name">Inter-agent handoffs</div><div class="desc">CIDs as pointers, one Agent pins and another retrieves.</div></div></li>
          </ol>
        </div>
        <div class="track">
          <div class="track-tag muted">To keep private</div>
          <div class="track-sub">wallet-owned, off-IPFS</div>
          <ol class="track-list">
            <li><span class="ord">01</span><div><div class="name">Long-term memory</div><div class="desc">Embeddings, summaries, working notes the Agent uses across runs.</div></div></li>
            <li><span class="ord">02</span><div><div class="name">Task receipts</div><div class="desc">On-chain payment paired with off-chain content the Agent owns.</div></div></li>
            <li><span class="ord">03</span><div><div class="name">Drafts and per-user state</div><div class="desc">Anything the Agent will edit before publishing, or keep scoped to one tenant.</div></div></li>
          </ol>
        </div>
      </div>
    </section>

    <div class="marquee rev" aria-hidden="true">
      <div class="marquee-track">
        <span>Pin to IPFS</span>
        <span>Keep private</span>
        <span>Wallet owns it</span>
        <span>Pay per use</span>
        <span>No SDK</span>
        <span>No API key</span>
        <span>Settles on-chain</span>
        <span>~30 seconds</span>
        <span>Pin to IPFS</span>
        <span>Keep private</span>
        <span>Wallet owns it</span>
        <span>Pay per use</span>
        <span>No SDK</span>
        <span>No API key</span>
        <span>Settles on-chain</span>
        <span>~30 seconds</span>
      </div>
    </div>

    <section id="flow">
      <div class="section-head">
        <div class="eyebrow">§ 03 · The loop</div>
        <h2 class="section-title">The flow is the <em>same shape</em> for both tracks.</h2>
      </div>

      <div class="flow-grid">
        <div class="flow-col">
          <div class="track-tag">Pin a CID</div>
          <div class="track-sub">POST /pins</div>
          <ol class="flow-steps">
            <li><span class="ord">Step 01</span><span class="step">The Agent POSTs to <code>/pins</code> with a CID. Tack responds <code>402</code> and quotes the price for the duration the Agent picked.</span></li>
            <li><span class="ord">Step 02</span><span class="step">The wallet signs one on-chain authorization. x402 on Taiko or Base, MPP on Tempo, whichever rail the wallet already holds funds on.</span></li>
            <li><span class="ord">Step 03</span><span class="step">Tack returns <code>202 Accepted</code> and pins the content. The wallet owns the pin and can list, replace, or delete any time.</span></li>
          </ol>
        </div>
        <div class="flow-col">
          <div class="track-tag muted">Keep private</div>
          <div class="track-sub">POST /private/objects</div>
          <ol class="flow-steps">
            <li><span class="ord">Step 01</span><span class="step">The Agent POSTs the bytes to <code>/private/objects</code> with the retention it wants. Tack responds <code>402</code> with the size-and-duration quote.</span></li>
            <li><span class="ord">Step 02</span><span class="step">The wallet signs the same x402 or MPP authorization it would for a public pin. Tack settles and stores the object on its private volume.</span></li>
            <li><span class="ord">Step 03</span><span class="step">Tack returns the object id and a bearer token. The wallet reads its bytes back at <code>/private/objects/:objectId/content</code>.</span></li>
            <li><span class="ord">Step 04</span><span class="step">When the token expires the Agent signs back in with SIWE at <code>/auth/challenge</code> and <code>/auth/token</code> for a fresh token. No CID is ever emitted.</span></li>
          </ol>
        </div>
      </div>
    </section>

    <section id="integrate">
      <div class="section-head">
        <div class="eyebrow">§ 04 · Integrate</div>
        <h2 class="section-title">Two endpoints, <em>one</em> integration.</h2>
      </div>

      <div class="integrate">
        <aside class="integrate-aside">
          <div class="label">→ API endpoint</div>
          <div class="url"><span class="host">${o}</span></div>
          <p class="note">Your Agent needs <strong>USDC on Taiko or Base</strong>, or <strong>USDC.e on Tempo</strong>. No ETH, no API keys.</p>
          <ul class="check">
            <li>IPFS Pinning Service API spec</li>
            <li>Private objects scoped to the paying wallet</li>
            <li>A2A agent card at <code>/.well-known/agent.json</code></li>
          </ul>
          <div class="chips">
            <span class="chip"><strong>x402</strong> · Taiko 167000</span>
            <span class="chip"><strong>x402</strong> · Base 8453</span>
            <span class="chip"><strong>MPP</strong> · Tempo 4217</span>
          </div>
        </aside>

        <div class="code-stack">
          <div class="code-block">
            <div class="code-track-head">
              <span class="idx">01</span>
              <div class="label-wrap">
                <span class="label">Pin a CID</span>
                <span class="path">/pins · public · paid</span>
              </div>
              <span class="verb">POST</span>
            </div>
            <div class="code-tabs" role="tablist" aria-label="Choose client">
              <button class="code-tab" role="tab" aria-selected="true" aria-controls="code-x402" id="tab-x402" data-tab="x402">x402 · Taiko/Base</button>
              <button class="code-tab" role="tab" aria-selected="false" aria-controls="code-mpp" id="tab-mpp" data-tab="mpp">MPP · Tempo</button>
              <button class="code-tab" role="tab" aria-selected="false" aria-controls="code-curl" id="tab-curl" data-tab="curl">curl</button>
            </div>
            <div class="code-pane" data-active="true" id="code-x402" role="tabpanel" aria-labelledby="tab-x402">
              <pre><code><span class="k">import</span> { wrapFetchWithPaymentFromConfig } <span class="k">from</span> <span class="s">"@x402/fetch"</span>;
<span class="k">import</span> { ExactEvmScheme, toClientEvmSigner } <span class="k">from</span> <span class="s">"@x402/evm"</span>;
<span class="k">import</span> { privateKeyToAccount } <span class="k">from</span> <span class="s">"viem/accounts"</span>;
<span class="k">import</span> { createPublicClient, http } <span class="k">from</span> <span class="s">"viem"</span>;
<span class="k">import</span> { taiko, base } <span class="k">from</span> <span class="s">"viem/chains"</span>;

<span class="k">const</span> account  = <span class="f">privateKeyToAccount</span>(<span class="s">"0x..."</span>);  <span class="c">// holds USDC on Taiko or Base</span>
<span class="k">const</span> taikoSig = <span class="f">toClientEvmSigner</span>(account, <span class="f">createPublicClient</span>({ chain: taiko, transport: <span class="f">http</span>() }));
<span class="k">const</span> baseSig  = <span class="f">toClientEvmSigner</span>(account, <span class="f">createPublicClient</span>({ chain: base,  transport: <span class="f">http</span>() }));

<span class="k">const</span> pay = <span class="f">wrapFetchWithPaymentFromConfig</span>(fetch, {
  schemes: [
    { network: <span class="s">"eip155:<span class="n">167000</span>"</span>, client: <span class="k">new</span> <span class="f">ExactEvmScheme</span>(taikoSig) },
    { network: <span class="s">"eip155:<span class="n">8453</span>"</span>,   client: <span class="k">new</span> <span class="f">ExactEvmScheme</span>(baseSig)  },
  ],
});

<span class="c">// Pin a CID for 6 months. USDC on whichever chain your wallet holds.</span>
<span class="k">const</span> res = <span class="k">await</span> <span class="f">pay</span>(<span class="s">"${o}/pins"</span>, {
  method: <span class="s">"POST"</span>,
  headers: { <span class="s">"X-Pin-Duration-Months"</span>: <span class="s">"6"</span> },
  body: <span class="f">JSON</span>.<span class="f">stringify</span>({ cid: <span class="s">"Qm..."</span> }),
});</code></pre>
            </div>
            <div class="code-pane" data-active="false" id="code-mpp" role="tabpanel" aria-labelledby="tab-mpp" hidden>
              <pre><code><span class="k">import</span> { Mppx, tempo } <span class="k">from</span> <span class="s">"mppx/client"</span>;
<span class="k">import</span> { privateKeyToAccount } <span class="k">from</span> <span class="s">"viem/accounts"</span>;

<span class="k">const</span> account = <span class="f">privateKeyToAccount</span>(<span class="s">"0x..."</span>);  <span class="c">// holds USDC.e on Tempo</span>

<span class="k">const</span> mppx = Mppx.<span class="f">create</span>({
  methods: [<span class="f">tempo</span>({ account })],   <span class="c">// Tempo 4217</span>
});

<span class="c">// Same endpoint. USDC.e on Tempo.</span>
<span class="k">const</span> res = <span class="k">await</span> mppx.<span class="f">fetch</span>(<span class="s">"${o}/pins"</span>, {
  method: <span class="s">"POST"</span>,
  headers: { <span class="s">"X-Pin-Duration-Months"</span>: <span class="s">"6"</span> },
  body: <span class="f">JSON</span>.<span class="f">stringify</span>({ cid: <span class="s">"Qm..."</span> }),
});</code></pre>
            </div>
            <div class="code-pane" data-active="false" id="code-curl" role="tabpanel" aria-labelledby="tab-curl" hidden>
              <pre><code><span class="c"># Ask for the quote. Tack returns a machine-readable 402.</span>
<span class="f">curl</span> -i -X POST <span class="s">${o}/pins</span> \\
  -H <span class="s">"X-Pin-Duration-Months: 6"</span> \\
  -d <span class="s">'{"cid":"Qm..."}'</span>

<span class="c"># → HTTP/1.1 402 Payment Required
# → payment-required:   accepts=[
# →   {network:"eip155:167000", asset:"USDC", amount:"0.10"},
# →   {network:"eip155:8453",   asset:"USDC", amount:"0.10"},
# → ]
# → WWW-Authenticate: Payment method="tempo", chainId=4217

# Pick any chain your wallet holds. Sign, retry. Tack pins, returns 202.</span></code></pre>
            </div>
            <div class="code-track-foot" aria-hidden="true">
              <span class="meta accent">402 → sign → 202</span>
              <span class="meta"><b>lang</b> typescript</span>
              <span class="meta"><b>auth</b> wallet signature</span>
            </div>
          </div>

          <div class="code-block">
            <div class="code-track-head">
              <span class="idx">02</span>
              <div class="label-wrap">
                <span class="label">Store a private object</span>
                <span class="path">/private/objects · private · paid</span>
              </div>
              <span class="verb">POST</span>
            </div>
            <div class="code-pane" data-active="true">
              <pre><code><span class="c">// Same wallet, same x402 (or MPP) credential as /pins.</span>
<span class="c">// Tack stores the bytes on its private volume — no CID is emitted.</span>
<span class="k">const</span> bytes = <span class="k">new</span> <span class="f">TextEncoder</span>().<span class="f">encode</span>(<span class="s">"agent memory: ..."</span>);

<span class="k">const</span> res = <span class="k">await</span> <span class="f">pay</span>(<span class="s">"${o}/private/objects"</span>, {
  method: <span class="s">"POST"</span>,
  headers: {
    <span class="s">"Content-Type"</span>:               <span class="s">"application/octet-stream"</span>,
    <span class="s">"X-Content-Size-Bytes"</span>:        <span class="f">String</span>(bytes.byteLength),
    <span class="s">"X-Storage-Duration-Months"</span>:  <span class="s">"3"</span>,
    <span class="s">"X-Object-Name"</span>:              <span class="s">"agent-memory-2026-05-19"</span>,
  },
  body: bytes,
});

<span class="k">const</span> { id } = <span class="k">await</span> res.<span class="f">json</span>();
<span class="k">const</span> bearer = res.<span class="f">headers</span>.<span class="f">get</span>(<span class="s">"x-wallet-auth-token"</span>);

<span class="c">// Read the bytes back any time. Only the paying wallet can.</span>
<span class="k">const</span> read = <span class="k">await</span> <span class="f">fetch</span>(<span class="s">\`\${o}/private/objects/\${id}/content\`</span>, {
  headers: { <span class="s">"Authorization"</span>: <span class="s">\`Bearer \${bearer}\`</span> },
});</code></pre>
            </div>
            <div class="code-track-foot" aria-hidden="true">
              <span class="meta accent">402 → sign → 202 + bearer</span>
              <span class="meta"><b>lang</b> typescript</span>
              <span class="meta"><b>retention</b> 1 – 24 months</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="rails">
      <div class="section-head">
        <div class="eyebrow">§ 05 · Rails</div>
        <h2 class="section-title">Two protocols, <em>three chains</em>, one set of endpoints.</h2>
      </div>

      <div class="rails">
        <article class="rail">
          <div class="rail-head">
            <div class="rail-name">x402</div>
            <div class="rail-chains">
              <span class="rail-chip">Taiko</span>
              <span class="rail-chip">Base</span>
            </div>
          </div>
          <p class="rail-blurb">HTTP 402 + EIP-3009. Your Agent signs a <code>transferWithAuthorization</code> once and a facilitator settles it on whichever chain it already holds USDC. No gas needed.</p>
          <div class="rail-spec">
            <div class="rail-spec-row"><span class="rail-spec-k">Asset</span><span class="rail-spec-v">USDC</span></div>
            <div class="rail-spec-row"><span class="rail-spec-k">Chains</span><span class="rail-spec-v"><span class="accent">167000</span> · Taiko &nbsp;·&nbsp; <span class="accent">8453</span> · Base</span></div>
            <div class="rail-spec-row"><span class="rail-spec-k">Scheme</span><span class="rail-spec-v">ExactEvm</span></div>
            <div class="rail-spec-row"><span class="rail-spec-k">Header</span><span class="rail-spec-v"><span class="accent">payment-signature</span></span></div>
          </div>
        </article>
        <article class="rail">
          <div class="rail-head">
            <div class="rail-name">MPP</div>
            <div class="rail-chains">
              <span class="rail-chip">Tempo</span>
            </div>
          </div>
          <p class="rail-blurb">Machine Payment Protocol + TIP-20. Tack re-reads the on-chain <code>Transfer</code> event to bind the pin to the EOA that signed, not the relay.</p>
          <div class="rail-spec">
            <div class="rail-spec-row"><span class="rail-spec-k">Asset</span><span class="rail-spec-v">USDC.e</span></div>
            <div class="rail-spec-row"><span class="rail-spec-k">Chain</span><span class="rail-spec-v"><span class="accent">4217</span> · Tempo</span></div>
            <div class="rail-spec-row"><span class="rail-spec-k">Scheme</span><span class="rail-spec-v">TIP-20 Transfer</span></div>
            <div class="rail-spec-row"><span class="rail-spec-k">Header</span><span class="rail-spec-v"><span class="accent">Authorization: Payment</span></span></div>
          </div>
        </article>
      </div>
    </section>

    <div class="marquee" aria-hidden="true">
      <div class="marquee-track">
        <span>$0.001 / pin · min</span>
        <span>$0.10 / GB-month</span>
        <span>1 – 24 months</span>
        <span>No subscriptions</span>
        <span>No platform lock-in</span>
        <span>12× cheaper than Pinata</span>
        <span>$0.001 / pin · min</span>
        <span>$0.10 / GB-month</span>
        <span>1 – 24 months</span>
        <span>No subscriptions</span>
        <span>No platform lock-in</span>
        <span>12× cheaper than Pinata</span>
      </div>
    </div>

    <section id="pricing">
      <div class="section-head">
        <div class="eyebrow">§ 06 · Pricing</div>
        <h2 class="section-title">Pay for <em>size</em> and duration, on either track.</h2>
      </div>

      <div class="fare">
        <div class="fare-col">
          <div class="fare-label">Pin · public</div>
          <div class="fare-price">$0.10</div>
          <div class="fare-unit">/ GB · month</div>
          <ul class="fare-list">
            <li><span class="k">Minimum</span><span class="v">$0.001 / pin</span></li>
            <li><span class="k">Term</span><span class="v">1 – 24 months</span></li>
            <li><span class="k">Asset</span><span class="v">USDC / USDC.e</span></li>
            <li><span class="k">Retrieval</span><span class="v">Free · paywalls opt-in</span></li>
          </ul>
        </div>
        <div class="fare-col hot">
          <div class="fare-label">Private · object</div>
          <div class="fare-price">$0.0010</div>
          <div class="fare-unit">/ 5 MB · 1 month</div>
          <ul class="fare-list">
            <li><span class="k">Same rate</span><span class="v">$0.10 / GB · month</span></li>
            <li><span class="k">Term</span><span class="v">1 – 24 months</span></li>
            <li><span class="k">Owner</span><span class="v">Paying wallet only</span></li>
            <li><span class="k">Refund</span><span class="v">Unused term on delete</span></li>
          </ul>
        </div>
        <div class="fare-col">
          <div class="fare-label">Pinata · x402 demo</div>
          <div class="fare-price">$1.20</div>
          <div class="fare-unit">/ GB · fixed 12 mo</div>
          <ul class="fare-list">
            <li><span class="k">Minimum</span><span class="v">12 months locked</span></li>
            <li><span class="k">Term</span><span class="v">Fixed 12 only</span></li>
            <li><span class="k">Chains</span><span class="v">Base only</span></li>
            <li><span class="k">Protocols</span><span class="v">x402 only</span></li>
          </ul>
        </div>
      </div>

      <p class="fare-footnote">Same $0.10 / GB&middot;month rate. Pinata&rsquo;s <a href="https://pinata.cloud/blog/pay-to-pin-on-ipfs-with-x402" target="_blank" rel="noopener">demo</a> locks every pin to 12 months; Tack lets you pick 1&ndash;24. At 3&nbsp;mo it&rsquo;s 4&times; cheaper, 6&nbsp;mo 2&times;, 12&nbsp;mo the same.</p>

      <div class="price-tool">
        <div class="price-tool-left">
          <div class="price-eyebrow">→ Live quote · drag the sliders</div>
          <div class="price-live" aria-live="polite">
            <span class="currency">$</span><span id="price-out">0.293</span>
          </div>
          <div class="price-sub" id="price-summary">500 MB · 6 months · settled on-chain</div>

          <div class="slider-group">
            <div class="slider-row">
              <span class="slider-label">Size</span>
              <span class="slider-val" id="size-val">500<span class="unit">MB</span></span>
            </div>
            <input type="range" class="tick-slider" id="size-slider" min="0" max="1000" value="539" aria-label="Storage size" />
          </div>

          <div class="slider-group" style="margin-bottom: 0;">
            <div class="slider-row">
              <span class="slider-label">Duration</span>
              <span class="slider-val" id="month-val">6<span class="unit">months</span></span>
            </div>
            <input type="range" class="tick-slider" id="month-slider" min="1" max="24" value="6" aria-label="Duration in months" />
          </div>
        </div>

        <div class="price-tool-right">
          <div class="price-eyebrow">→ Built-in</div>
          <ul class="price-facts">
            <li>Settled in <code>USDC</code> on Taiko or Base, or <code>USDC.e</code> on Tempo.</li>
            <li>Retrieval is free. Paywalls are opt-in, per CID.</li>
            <li>Pins and private objects auto-expire. No recurring charges.</li>
            <li>Owner ops — list, replace, delete — don't re-charge.</li>
            <li><code>price = clamp(sizeGB × $0.10 × months, $0.001, $50)</code>. Size is binary (1&nbsp;GB = 1,073,741,824 bytes). Duration is 1&ndash;24 months, set with <code>X-Pin-Duration-Months</code> for pins or <code>X-Storage-Duration-Months</code> for private objects. Settlement rounds up to the next asset unit.</li>
          </ul>
        </div>
      </div>
    </section>

    <section id="api">
      <div class="section-head">
        <div class="eyebrow">§ 07 · API</div>
        <h2 class="section-title">The <em>full surface</em>, pin endpoints and private object endpoints.</h2>
      </div>

      <div class="api-group-head">
        <span class="track-tag">Pin endpoints</span>
        <span class="track-sub">public, addressable by CID</span>
      </div>
      <div class="api-grid">
        <div class="api-row">
          <span class="api-method">POST</span>
          <div><div class="api-path">/pins</div><div class="api-desc">Pin a CID. 402 with price → sign → retry.</div></div>
          <span class="api-tag pay">x402 · MPP</span>
        </div>
        <div class="api-row">
          <span class="api-method">POST</span>
          <div><div class="api-path">/upload</div><div class="api-desc">Upload bytes (up to 100 MB) and pin in one request.</div></div>
          <span class="api-tag pay">x402 · MPP</span>
        </div>
        <div class="api-row">
          <span class="api-method get">GET</span>
          <div><div class="api-path">/pins</div><div class="api-desc">List pins your wallet owns.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method get">GET</span>
          <div><div class="api-path">/pins/:requestid</div><div class="api-desc">Status for a specific pin request.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method">POST</span>
          <div><div class="api-path">/pins/:requestid</div><div class="api-desc">Replace a pin, keep the request id.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method delete">DELETE</span>
          <div><div class="api-path">/pins/:requestid</div><div class="api-desc">Unpin content your wallet owns.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method get">GET</span>
          <div><div class="api-path">/ipfs/:cid</div><div class="api-desc">Retrieve content. Ranges, ETags, optional paywall.</div></div>
          <span class="api-tag">public</span>
        </div>
        <div class="api-row">
          <span class="api-method get">GET</span>
          <div><div class="api-path">/.well-known/agent.json</div><div class="api-desc">A2A agent card. Machines discover, verify, pay.</div></div>
          <span class="api-tag">public</span>
        </div>
        <div class="api-row">
          <span class="api-method get">GET</span>
          <div><div class="api-path">/openapi.json</div><div class="api-desc">OpenAPI 3.1 spec covering public, paid, and owner routes.</div></div>
          <span class="api-tag">public</span>
        </div>
      </div>

      <div class="api-group-head second">
        <span class="track-tag muted">Private object endpoints</span>
        <span class="track-sub">wallet-owned, off-IPFS</span>
      </div>
      <div class="api-grid">
        <div class="api-row">
          <span class="api-method">POST</span>
          <div><div class="api-path">/private/objects</div><div class="api-desc">Create a private object. 402 with price → sign → retry.</div></div>
          <span class="api-tag pay">x402 · MPP</span>
        </div>
        <div class="api-row">
          <span class="api-method get">GET</span>
          <div><div class="api-path">/private/objects</div><div class="api-desc">List the private objects your wallet owns.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method get">GET</span>
          <div><div class="api-path">/private/objects/:objectId</div><div class="api-desc">Get metadata for a private object you own.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method get">GET</span>
          <div><div class="api-path">/private/objects/:objectId/content</div><div class="api-desc">Read the bytes, with range and ETag support.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method">POST</span>
          <div><div class="api-path">/private/objects/:objectId/renew</div><div class="api-desc">Extend retention for a private object you own.</div></div>
          <span class="api-tag pay">bearer · x402 · MPP</span>
        </div>
        <div class="api-row">
          <span class="api-method patch">PATCH</span>
          <div><div class="api-path">/private/objects/:objectId</div><div class="api-desc">Update a private object's name or metadata.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method delete">DELETE</span>
          <div><div class="api-path">/private/objects/:objectId</div><div class="api-desc">Delete early, refund unused retention.</div></div>
          <span class="api-tag">bearer</span>
        </div>
        <div class="api-row">
          <span class="api-method">POST</span>
          <div><div class="api-path">/auth/challenge → /auth/token</div><div class="api-desc">Sign in with SIWE for a fresh bearer token.</div></div>
          <span class="api-tag">public</span>
        </div>
      </div>
    </section>

    <section id="inference-room" class="accent-section">
      <div class="section-head">
        <div class="eyebrow">§ 08 · Where this lives</div>
        <h2 class="section-title">Tack is the first product in <em>Inference Room</em>.</h2>
      </div>

      <div class="ir-body">
        <p>Inference Room is an independent launchpad for AI Agents and the infrastructure they need to ship. Tack is the first resident, focused on storage. Bantō, the finance multisig Agent on Safe, is the second.</p>
        <p>Every resident has its own product, its own brand, and its own roadmap. What they share is a thesis: AI Agents need primitives that were designed for Agents, not retrofitted from products built for humans. Pin-for-humans does not work for Agents, multisig-for-humans does not work for finance Agents, and the same shape of mismatch shows up in every layer underneath.</p>
        <p>Inference Room is where those primitives get built and shipped.</p>
      </div>

      <a class="ir-link" href="https://inferenceroom.ai" target="_blank" rel="noopener">Read more at inferenceroom.ai →</a>
    </section>

    <section id="faq">
      <div class="section-head">
        <div class="eyebrow">§ 09 · FAQ</div>
        <h2 class="section-title"><em>Questions</em> builders actually ask.</h2>
      </div>

      <div class="faq">
        <div class="faq-row">
          <div class="faq-num">01</div>
          <div class="faq-q">How do I store AI Agent memory without pinning it to IPFS?</div>
          <div class="faq-a">Use Tack's private object endpoint. Send the bytes to <code>POST /private/objects</code>, sign the EIP-3009 authorization over x402 or attach an MPP credential, and the object is stored on Tack's private volume scoped to the paying wallet. No CID is ever emitted, no IPFS gateway will serve it, and only the owning wallet can read it back through the API.</div>
        </div>
        <div class="faq-row">
          <div class="faq-num">02</div>
          <div class="faq-q">What is the cheapest IPFS pinning service for AI Agents?</div>
          <div class="faq-a">Tack settles at roughly $0.10 per GB-month when measured against Pinata's published x402 demo, which fixes 12 months as the only term. Tack lets the Agent pick anywhere from 1 to 24 months, so for a typical short pin Tack is approximately 12× cheaper. Pricing is per-pin, paid in USDC, no subscriptions.</div>
        </div>
        <div class="faq-row">
          <div class="faq-num">03</div>
          <div class="faq-q">How does x402 work for AI Agent payments?</div>
          <div class="faq-a">x402 is the HTTP 402 Payment Required flow paired with EIP-3009 <code>transferWithAuthorization</code>. The Agent posts to a paid endpoint, the server returns 402 with a price quote, the Agent's wallet signs the transferWithAuthorization once, and the server resubmits the request with the signed payment header. A facilitator settles the USDC transfer on whichever chain the wallet already holds funds on. No gas is required, no separate billing account is needed.</div>
        </div>
        <div class="faq-row">
          <div class="faq-num">04</div>
          <div class="faq-q">What is a Pinata alternative for AI Agents?</div>
          <div class="faq-a">Tack is built specifically for AI Agents, with wallet-based identity instead of email plus API key, per-pin USDC payment instead of a $20 monthly minimum, an A2A agent card at the well-known URL, and a private storage track for state the Agent does not want pinned. The full IPFS Pinning Service API spec is supported so any existing Pinata integration ports across.</div>
        </div>
        <div class="faq-row">
          <div class="faq-num">05</div>
          <div class="faq-q">Where should AI Agents store private data that should not be public?</div>
          <div class="faq-a">On Tack's private object track. Bytes live on Tack's private volume, never pinned to IPFS, addressable only by a random object id that the paying wallet owns. Requests without a bearer token get a 401, and another wallet's valid token gets a 404 (not a 403), so the existence of the object is itself not leaked to anyone but the owner.</div>
        </div>
        <div class="faq-row">
          <div class="faq-num">06</div>
          <div class="faq-q">Is Tack's private storage end-to-end encrypted?</div>
          <div class="faq-a">No. Private here means access-gated by wallet, not end-to-end encrypted. Bytes sit on Tack's volume in plaintext at rest. Tack can technically read them, only the owning wallet can read them through the API. If a use case needs confidentiality from the operator, encrypt client-side before upload and let the wallet remain the access boundary.</div>
        </div>
        <div class="faq-row">
          <div class="faq-num">07</div>
          <div class="faq-q">How does an Agent retrieve content it pinned to Tack?</div>
          <div class="faq-a">For public pins, fetch from the public gateway at <code>GET /ipfs/&lt;cid&gt;</code>. For private objects, send <code>GET /private/objects/&lt;obj_id&gt;/content</code> with the bearer token returned at payment, or sign back in with SIWE at <code>/auth/challenge</code> and <code>/auth/token</code> if the original token has expired.</div>
        </div>
        <div class="faq-row">
          <div class="faq-num">08</div>
          <div class="faq-q">What chains does Tack support?</div>
          <div class="faq-a">USDC settlement on Taiko (chain id 167000) and Base (chain id 8453) via x402, and USDC.e on Tempo (chain id 4217) via MPP. The Agent's wallet picks whichever rail it already holds funds on. No bridging required.</div>
        </div>
        <div class="faq-row">
          <div class="faq-num">09</div>
          <div class="faq-q">Does Tack work with Claude Code, Codex, OpenClaw, or Hermes?</div>
          <div class="faq-a">Yes. The full IPFS Pinning Service API spec is supported plus an A2A agent card published at <code>/.well-known/agent.json</code>. Any HTTP client an Agent uses works. No SDK is required, no platform-specific adapter, and no API key beyond the wallet signature.</div>
        </div>
      </div>
    </section>

    <section class="closer">
      <h2 class="closer-headline">A place for your Agent to keep things. The public ones and the private ones<span class="dot">.</span></h2>
      <div class="closer-foot">
        <p class="closer-body">Two endpoints away.</p>
        <div class="closer-cta">
          <button class="btn-fill" data-copy="${o}" aria-label="Copy base URL">Copy ${o}</button>
          <a class="btn-ghost" href="${o}/.well-known/agent.json" target="_blank" rel="noopener">Agent card →</a>
        </div>
      </div>
      <div class="closer-trust" aria-label="Ecosystem">
        <div class="closer-trust-item"><b>Taiko</b> · 167000</div>
        <div class="closer-trust-item"><b>Base</b> · 8453</div>
        <div class="closer-trust-item"><b>Tempo</b> · 4217</div>
        <div class="closer-trust-item"><b>IPFS</b> · Kubo</div>
        <div class="closer-trust-item"><b>A2A</b> · agent card</div>
      </div>
    </section>

  </main>

  <footer>
    <div class="footer-inner">
      <a class="logo" href="#top" aria-label="Tack home"><span class="slash">/</span><span>tack</span></a>
      <div class="footer-links">
        <a href="${o}/health">status</a>
        <a href="${o}/.well-known/agent.json" target="_blank" rel="noopener">agent card</a>
        <a href="https://www.x402.org/" target="_blank" rel="noopener">x402</a>
        <a href="https://mpp.dev/" target="_blank" rel="noopener">mpp</a>
      </div>
      <div class="footer-tag">a place for your Agent to keep things</div>
    </div>
  </footer>

  <script>
  (function () {
    // Copy-to-clipboard
    var copyBtns = document.querySelectorAll('[data-copy]');
    copyBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-copy');
        var label = btn.querySelector('.copy-btn-label');
        var originalLabel = label ? label.textContent : '';
        var finish = function () {
          btn.classList.add('copied');
          if (label) label.textContent = 'Copied';
          setTimeout(function () {
            btn.classList.remove('copied');
            if (label) label.textContent = originalLabel;
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(finish, fallback);
        } else { fallback(); }
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = value; ta.setAttribute('readonly', '');
          ta.style.position = 'fixed'; ta.style.top = '-9999px';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); finish(); } catch (e) { /* noop */ }
          document.body.removeChild(ta);
        }
      });
    });

    // Code tabs
    var tabs = document.querySelectorAll('[role="tab"][data-tab]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-tab');
        tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
        document.querySelectorAll('.code-pane').forEach(function (p) {
          if (!p.id) return;
          var isMatch = p.id === 'code-' + key;
          p.setAttribute('data-active', isMatch ? 'true' : 'false');
          if (isMatch) { p.removeAttribute('hidden'); } else { p.setAttribute('hidden', ''); }
        });
      });
      tab.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var list = Array.prototype.slice.call(tabs);
        var idx = list.indexOf(tab);
        var next = e.key === 'ArrowRight' ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
        list[next].focus(); list[next].click();
      });
    });

    // Pricing slider
    var sizeSlider  = document.getElementById('size-slider');
    var monthSlider = document.getElementById('month-slider');
    var sizeVal     = document.getElementById('size-val');
    var monthVal    = document.getElementById('month-val');
    var priceOut    = document.getElementById('price-out');
    var priceSum    = document.getElementById('price-summary');

    if (sizeSlider && monthSlider && priceOut) {
      var MB_MIN = 1;
      var MB_MAX = 100 * 1024;
      var LOG_MIN = Math.log10(MB_MIN);
      var LOG_MAX = Math.log10(MB_MAX);
      function sliderToMB(v) { var t = v / 1000; return Math.pow(10, LOG_MIN + t * (LOG_MAX - LOG_MIN)); }
      function niceMB(mb) {
        if (mb < 10) return Math.max(1, Math.round(mb));
        if (mb < 100) return Math.round(mb / 5) * 5;
        if (mb < 1024) return Math.round(mb / 10) * 10;
        if (mb < 10 * 1024) return Math.round(mb / 512) * 512;
        return Math.round(mb / 1024) * 1024;
      }
      function formatSize(mb) {
        if (mb < 1024) return { n: String(mb), u: 'MB' };
        var gb = mb / 1024;
        if (gb < 10) return { n: gb.toFixed(1).replace(/\\.0$/, ''), u: 'GB' };
        return { n: String(Math.round(gb)), u: 'GB' };
      }
      function formatPrice(usd) {
        if (usd <= 0.001)  return '0.001';
        if (usd < 0.01)    return usd.toFixed(4).replace(/0+$/, '').replace(/\\.$/, '');
        if (usd < 1)       return usd.toFixed(3).replace(/0+$/, '').replace(/\\.$/, '');
        if (usd < 100)     return usd.toFixed(2);
        return String(Math.round(usd));
      }
      function calcPrice(sizeMB, months) {
        var gb = sizeMB / 1024;
        var raw = gb * 0.10 * months;
        return Math.min(Math.max(raw, 0.001), 50);
      }
      function update() {
        var rawMB = sliderToMB(parseFloat(sizeSlider.value));
        var mb = niceMB(rawMB);
        var months = parseInt(monthSlider.value, 10);
        var sz = formatSize(mb);
        sizeVal.innerHTML = sz.n + '<span class="unit">' + sz.u + '</span>';
        monthVal.innerHTML = months + '<span class="unit">' + (months === 1 ? 'month' : 'months') + '</span>';
        priceOut.textContent = formatPrice(calcPrice(mb, months));
        priceSum.textContent = sz.n + ' ' + sz.u + ' · ' + months + ' ' + (months === 1 ? 'month' : 'months') + ' · settled on-chain';
      }
      sizeSlider.addEventListener('input', update);
      monthSlider.addEventListener('input', update);
      update();
    }
  })();
  </script>

</body>
</html>`;
}

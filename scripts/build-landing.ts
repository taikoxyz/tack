import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { faviconSvg, googleSiteVerification, landingPageHtml } from '../src/landing';

const outDir = resolve(process.cwd(), 'dist', 'landing');
const outFile = resolve(outDir, 'index.html');
const faviconFile = resolve(outDir, 'favicon.svg');
const gsvFile = resolve(outDir, googleSiteVerification.filename);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, landingPageHtml(), 'utf8');
writeFileSync(faviconFile, faviconSvg, 'utf8');
writeFileSync(gsvFile, googleSiteVerification.content, 'utf8');

console.log(`Wrote ${outFile}`);
console.log(`Wrote ${faviconFile}`);
console.log(`Wrote ${gsvFile}`);

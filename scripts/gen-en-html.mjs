/**
 * Post-build script: generate dist/en/index.html from dist/index.html
 * with English Open Graph / Twitter meta tags.
 *
 * The English page loads the SAME app (same JS/CSS assets), only the
 * static meta tags differ for social sharing crawlers (which don't
 * execute JS). The app detects /en in the URL path to default to EN.
 *
 * Usage: node scripts/gen-en-html.mjs
 * Called automatically by: npm run build (see package.json)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const srcHtml = join(distDir, 'index.html');
const enDir = join(distDir, 'en');
const destHtml = join(enDir, 'index.html');

let html = readFileSync(srcHtml, 'utf-8');

// Replace OG/Twitter meta tags with English versions
const replacements = [
  ['<meta property="og:url" content="https://cognitive-signature.com/" />',
   '<meta property="og:url" content="https://cognitive-signature.com/en" />'],

  ['<meta property="og:title" content="Ton empreinte d\'humanité" />',
   '<meta property="og:title" content="What is your human signature?" />'],

  ['<meta property="og:description" content="5 défis cognitifs en 60 secondes. Découvre la signature que seule un humain peut produire." />',
   '<meta property="og:description" content="5 challenges, 60 seconds. Your mind and your hand leave a signature all your own — discover yours." />'],

  ['<meta property="og:image" content="https://cognitive-signature.com/og.image.png" />',
   '<meta property="og:image" content="https://cognitive-signature.com/og.image-en.png" />'],

  ['<meta property="og:image:alt" content="Ton empreinte d\'humanité — Cognitive Signature" />',
   '<meta property="og:image:alt" content="What is your human signature? — Cognitive Signature" />'],

  ['<meta property="og:locale" content="fr_FR" />',
   '<meta property="og:locale" content="en_US" />'],

  ['<meta name="twitter:title" content="Ton empreinte d\'humanité" />',
   '<meta name="twitter:title" content="What is your human signature?" />'],

  ['<meta name="twitter:description" content="5 défis cognitifs en 60 secondes. Découvre la signature que seule un humain peut produire." />',
   '<meta name="twitter:description" content="5 challenges, 60 seconds. Your mind and your hand leave a signature all your own — discover yours." />'],

  ['<meta name="twitter:image" content="https://cognitive-signature.com/og.image.png" />',
   '<meta name="twitter:image" content="https://cognitive-signature.com/og.image-en.png" />'],

  ['<meta name="description" content="Ton empreinte d\'humanité — 5 défis cognitifs en 60 secondes. Aucune inscription." />',
   '<meta name="description" content="Your human signature — 5 challenges, 60 seconds. No sign-up." />'],

  ['<title>Ton empreinte d\'humanité — Cognitive Signature</title>',
   '<title>Your human signature — Cognitive Signature</title>'],

  ['<html lang="fr">',
   '<html lang="en">'],
];

for (const [from, to] of replacements) {
  if (!html.includes(from)) {
    console.warn(`[gen-en-html] WARNING: tag not found in dist/index.html: ${from.slice(0, 80)}...`);
  }
  html = html.replace(from, to);
}

mkdirSync(enDir, { recursive: true });
writeFileSync(destHtml, html, 'utf-8');
console.log('[gen-en-html] Generated dist/en/index.html with English OG tags');

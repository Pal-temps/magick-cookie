// Email security scanner — local content-based analysis (no external API)

export type SecurityLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface SecurityResult {
  score: number;
  level: SecurityLevel;
  warnings: string[];
}

export interface LightScanInput {
  fromAddress: string;
  fromName: string;
  subject: string;
  attachmentNames: string[];
}

export interface FullScanInput extends LightScanInput {
  html: string | null;
  text: string | null;
}

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "scr", "pif", "vbs", "vbe", "js", "jse",
  "ws", "wsf", "wsc", "wsh", "ps1", "ps2", "psc1", "psc2", "msi", "msp",
  "mst", "cpl", "hta", "inf", "ins", "isp", "reg", "rgs", "sct", "shb",
  "shs", "lnk", "dll", "sys", "drv",
]);

const MACRO_EXTENSIONS = new Set(["docm", "xlsm", "pptm"]);

// Real brand names whose legitimate emails should come from the brand's own domain. If one of
// these appears in the sender's display name but the `From:` domain doesn't match, we treat that
// as a spoofing signal. Generic urgency words ("urgent", "security", "verify") were moved out
// because they produced too many false positives — a real PayPal security notice legitimately
// contains the word "security".
const BRAND_KEYWORDS = [
  "paypal", "amazon", "google", "microsoft", "apple", "netflix",
  "facebook", "instagram", "linkedin", "twitter", "ebay", "stripe",
  "dhl", "fedex", "ups", "la poste", "chronopost",
];

// Must match a phrase, not a single word — "urgent" alone appears in millions of legitimate
// emails (calendar invites, meeting notes, RH communications). We only flag when urgency is
// combined with an action requested of the reader, which is the phishing pattern.
const URGENCY_PATTERNS = [
  /action requise/i,
  /action required/i,
  /compte (a ete )?suspendu/i,
  /account (has been )?suspended/i,
  /verify your (account|identity|password)/i,
  /confirm your (account|identity|password)/i,
  /click (here|below) (to|now)/i,
  /act (now|immediately|fast)/i,
  /within 24 hours/i,
  /last (warning|notice|chance)/i,
];

const SHORT_URL_DOMAINS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly",
  "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at",
]);

const PHISHING_PATTERNS = [
  /javascript:/i,
  /data:text\/html/i,
  /\bon\w+\s*=/i, // onclick=, onerror=, etc.
  /<script[\s>]/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
];

function scoreToLevel(score: number): SecurityLevel {
  if (score === 0) return "safe";
  if (score <= 3) return "low";
  if (score <= 6) return "medium";
  if (score <= 8) return "high";
  return "critical";
}

function checkAttachments(names: string[], warnings: string[]): number {
  let score = 0;
  for (const name of names) {
    const parts = name.split(".");
    if (parts.length >= 3) {
      const lastExt = parts[parts.length - 1].toLowerCase();
      if (DANGEROUS_EXTENSIONS.has(lastExt)) {
        warnings.push(`Piece jointe dangereuse : ${name} (double extension)`);
        score += 8;
        continue;
      }
    }
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      warnings.push(`Piece jointe executable : ${name}`);
      score += 7;
    } else if (MACRO_EXTENSIONS.has(ext)) {
      warnings.push(`Piece jointe avec macros : ${name}`);
      score += 4;
    }
  }
  return score;
}

// A brand legitimately owns a domain when one of its labels equals the brand exactly —
// `paypal.com`, `mail.paypal.com`, `paypal.co.uk` match; `paypal-reset.com`,
// `paypal.attacker.com`, `notpaypal.com` do not (substring matches would let the attacker
// smuggle the brand name into their own domain).
function domainOwnedByBrand(domain: string, brand: string): boolean {
  const brandToken = brand.replace(/\s/g, "");
  const labels = domain.split(".");
  return labels.slice(0, -1).some((label) => label === brandToken);
}

function checkSender(fromAddress: string, fromName: string, warnings: string[]): number {
  let score = 0;
  const nameLower = fromName.toLowerCase();
  const domain = fromAddress.split("@")[1]?.toLowerCase() ?? "";

  for (const brand of BRAND_KEYWORDS) {
    if (nameLower.includes(brand) && !domainOwnedByBrand(domain, brand)) {
      warnings.push(`Usurpation possible : le nom "${fromName}" ne correspond pas au domaine ${domain}`);
      score += 3;
      break;
    }
  }
  return score;
}

function checkSubject(subject: string, warnings: string[]): number {
  for (const pattern of URGENCY_PATTERNS) {
    if (pattern.test(subject)) {
      warnings.push(`Sujet avec urgence suspecte : "${subject}"`);
      return 2;
    }
  }
  return 0;
}

function checkHtml(html: string, warnings: string[]): number {
  let score = 0;

  // Phishing patterns
  for (const pattern of PHISHING_PATTERNS) {
    if (pattern.test(html)) {
      warnings.push("Contenu HTML suspect (scripts ou elements dangereux)");
      score += 3;
      break;
    }
  }

  // Password forms
  if (/<input[^>]*type\s*=\s*["']?password/i.test(html)) {
    warnings.push("Formulaire de mot de passe dans l'email");
    score += 6;
  }

  // Hidden fields
  if (/<input[^>]*type\s*=\s*["']?hidden/i.test(html)) {
    warnings.push("Champs de formulaire caches");
    score += 4;
  }

  // Link mismatches (text shows one domain, href goes elsewhere)
  const linkRegex = /<a[^>]*href\s*=\s*["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  let mismatchCount = 0;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null && mismatchCount < 3) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (/^https?:\/\//.test(text)) {
      try {
        const hrefDomain = new URL(href).hostname.replace(/^www\./, "");
        const textDomain = new URL(text).hostname.replace(/^www\./, "");
        if (hrefDomain !== textDomain) {
          warnings.push(`Lien trompeur : affiche ${textDomain} mais redirige vers ${hrefDomain}`);
          score += 5;
          mismatchCount++;
        }
      } catch { /* invalid URL */ }
    }
  }

  // Shortened URLs
  const shortRegex = /https?:\/\/([^/\s"']+)/gi;
  while ((match = shortRegex.exec(html)) !== null) {
    const domain = match[1].toLowerCase();
    if (SHORT_URL_DOMAINS.has(domain)) {
      warnings.push(`URL raccourcie detectee : ${domain}`);
      score += 3;
      break;
    }
  }

  return score;
}

/** Light scan — fast, no HTML parsing. For message listing. */
export function scanEmailLight(input: LightScanInput): { level: SecurityLevel; score: number } {
  const warnings: string[] = [];
  let score = 0;
  score += checkSender(input.fromAddress, input.fromName, warnings);
  score += checkSubject(input.subject, warnings);
  score += checkAttachments(input.attachmentNames, warnings);
  score = Math.min(score, 10);
  return { level: scoreToLevel(score), score };
}

/** Full scan — parses HTML content. For message detail view. */
export function scanEmail(input: FullScanInput): SecurityResult {
  const warnings: string[] = [];
  let score = 0;
  score += checkSender(input.fromAddress, input.fromName, warnings);
  score += checkSubject(input.subject, warnings);
  score += checkAttachments(input.attachmentNames, warnings);
  if (input.html) score += checkHtml(input.html, warnings);
  score = Math.min(score, 10);
  return { score, level: scoreToLevel(score), warnings };
}

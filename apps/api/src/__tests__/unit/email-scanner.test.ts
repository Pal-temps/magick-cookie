import { describe, test, expect } from "bun:test";
import { scanEmailLight, scanEmail } from "../../application/email/email-scanner";

const baseLight = {
  fromAddress: "alice@example.com",
  fromName: "Alice",
  subject: "Hello",
  attachmentNames: [] as string[],
};

describe("email-scanner — scanEmailLight", () => {
  test("marks a plain email as safe", () => {
    const r = scanEmailLight(baseLight);
    expect(r.level).toBe("safe");
    expect(r.score).toBe(0);
  });

  test("does NOT flag the word 'urgent' alone in a legitimate subject", () => {
    const r = scanEmailLight({ ...baseLight, subject: "Urgent: meeting moved to 3pm" });
    expect(r.level).toBe("safe");
  });

  test("does NOT flag the word 'security' in a legitimate brand email", () => {
    const r = scanEmailLight({
      ...baseLight,
      fromAddress: "security@paypal.com",
      fromName: "PayPal Security",
      subject: "Your security settings were updated",
    });
    expect(r.level).toBe("safe");
  });

  test("flags brand spoofing when sender name claims PayPal but the domain is elsewhere", () => {
    const r = scanEmailLight({
      ...baseLight,
      fromAddress: "noreply@paypal-reset-alert.com",
      fromName: "PayPal Security",
    });
    expect(r.level).not.toBe("safe");
    expect(r.score).toBeGreaterThan(0);
  });

  test("flags phrase-level urgency with action CTA", () => {
    const r = scanEmailLight({
      ...baseLight,
      subject: "Verify your account within 24 hours",
    });
    expect(r.level).not.toBe("safe");
  });

  test("flags executable attachments", () => {
    const r = scanEmailLight({ ...baseLight, attachmentNames: ["invoice.exe"] });
    expect(r.score).toBeGreaterThanOrEqual(7);
    expect(r.level === "high" || r.level === "critical").toBe(true);
  });

  test("flags double-extension masquerade", () => {
    const r = scanEmailLight({ ...baseLight, attachmentNames: ["report.pdf.exe"] });
    expect(r.score).toBeGreaterThanOrEqual(8);
    expect(r.level === "high" || r.level === "critical").toBe(true);
  });

  test("flags macro-enabled Office attachments", () => {
    const r = scanEmailLight({ ...baseLight, attachmentNames: ["budget.xlsm"] });
    expect(r.level === "low" || r.level === "medium").toBe(true);
  });
});

describe("email-scanner — scanEmail (with HTML)", () => {
  test("flags password forms in HTML", () => {
    const r = scanEmail({
      ...baseLight,
      html: `<form><input type="password" name="pw"></form>`,
      text: "",
    });
    expect(r.score).toBeGreaterThanOrEqual(6);
  });

  test("flags <script> and javascript: payloads", () => {
    const r = scanEmail({
      ...baseLight,
      html: `<a href="javascript:alert(1)">click</a><script>alert(1)</script>`,
      text: "",
    });
    expect(r.warnings.some((w) => w.includes("Contenu HTML suspect"))).toBe(true);
  });

  test("flags shortened URL domains", () => {
    const r = scanEmail({
      ...baseLight,
      html: `<a href="https://bit.ly/abcdef">click</a>`,
      text: "",
    });
    expect(r.warnings.some((w) => w.toLowerCase().includes("raccourcie"))).toBe(true);
  });

  test("flags link mismatch (visible text ≠ href)", () => {
    const r = scanEmail({
      ...baseLight,
      html: `<a href="https://phishing.example.com">https://paypal.com/login</a>`,
      text: "",
    });
    expect(r.warnings.some((w) => w.toLowerCase().includes("trompeur"))).toBe(true);
  });

  test("safe on plain HTML", () => {
    const r = scanEmail({
      ...baseLight,
      html: `<p>Hello, here is the report.</p>`,
      text: "Hello, here is the report.",
    });
    expect(r.level).toBe("safe");
  });

  test("clamps score at 10", () => {
    const r = scanEmail({
      ...baseLight,
      fromAddress: "noreply@paypal-reset.com",
      fromName: "PayPal Security",
      subject: "Verify your account within 24 hours",
      attachmentNames: ["invoice.pdf.exe"],
      html: `<form><input type="password"><input type="hidden" name="x"></form>`,
      text: "",
    });
    expect(r.score).toBeLessThanOrEqual(10);
    expect(r.level).toBe("critical");
  });
});

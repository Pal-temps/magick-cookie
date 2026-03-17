import { describe, it, expect } from "bun:test";

// Test the pctDelta logic directly
function pctDelta(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

describe("Weekly Review - Delta Calculations", () => {
  it("should return null when both values are 0", () => {
    expect(pctDelta(0, 0)).toBeNull();
  });

  it("should return 100 when previous is 0 and current is positive (0 → N)", () => {
    expect(pctDelta(10, 0)).toBe(100);
  });

  it("should return -100 when current is 0 and previous is positive (N → 0)", () => {
    expect(pctDelta(0, 10)).toBe(-100);
  });

  it("should return 0 when both values are the same", () => {
    expect(pctDelta(10, 10)).toBe(0);
  });

  it("should return positive percentage for improvement", () => {
    expect(pctDelta(15, 10)).toBe(50);
  });

  it("should return negative percentage for decline", () => {
    expect(pctDelta(5, 10)).toBe(-50);
  });

  it("should handle large increases", () => {
    expect(pctDelta(100, 10)).toBe(900);
  });

  it("should round to nearest integer", () => {
    expect(pctDelta(10, 3)).toBe(233);
  });
});

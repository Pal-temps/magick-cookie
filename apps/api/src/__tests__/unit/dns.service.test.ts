import { describe, it, expect, mock, beforeEach } from "bun:test";
import { DnsService } from "../../infrastructure/dns/dns.service";

// We test the DnsService aggregation logic with mocked providers.
// The actual OVH/Cloudflare API calls are tested via integration tests.

describe("DnsService", () => {
  it("should instantiate without errors when no credentials are configured", () => {
    const service = new DnsService();
    expect(service).toBeDefined();
  });

  it("getZones returns empty array when no providers configured", async () => {
    const service = new DnsService();
    const zones = await service.getZones();
    expect(zones).toEqual([]);
  });

  it("detectProvider returns null for unknown zone", async () => {
    const service = new DnsService();
    const provider = await service.detectProvider("nonexistent.com");
    expect(provider).toBeNull();
  });

  it("listRecords throws for unknown zone", async () => {
    const service = new DnsService();
    try {
      await service.listRecords("nonexistent.com");
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain("not found");
    }
  });
});

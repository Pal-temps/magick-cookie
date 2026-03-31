import { infraConfig } from "../../config";
import type { DnsProvider, DnsRecord, NewDnsRecord } from "./dns.service";

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${infraConfig.cfApiToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudflare API ${method} ${path}: ${res.status} ${err}`);
  }

  const json = await res.json() as { success: boolean; result: T; errors?: { message: string }[] };
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
    throw new Error(`Cloudflare API error: ${msg}`);
  }

  return json.result;
}

// Cloudflare zone shape
interface CfZone {
  id: string;
  name: string;
}

// Cloudflare record shape
interface CfRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
}

// Cache zone ID lookups
const zoneIdCache = new Map<string, string>();

async function getZoneId(zoneName: string): Promise<string> {
  if (zoneIdCache.has(zoneName)) return zoneIdCache.get(zoneName)!;
  const zones = await cfRequest<CfZone[]>("GET", `/zones?name=${zoneName}`);
  if (zones.length === 0) throw new Error(`Cloudflare zone "${zoneName}" not found`);
  zoneIdCache.set(zoneName, zones[0].id);
  return zones[0].id;
}

export class CloudflareDnsAdapter implements DnsProvider {
  readonly provider = "cloudflare" as const;

  async getZones(): Promise<string[]> {
    const zones = await cfRequest<CfZone[]>("GET", "/zones?per_page=50");
    for (const z of zones) zoneIdCache.set(z.name, z.id);
    return zones.map((z) => z.name);
  }

  async listRecords(zone: string, type?: string): Promise<DnsRecord[]> {
    const zoneId = await getZoneId(zone);
    const params = type ? `?type=${type}` : "";
    const records = await cfRequest<CfRecord[]>("GET", `/zones/${zoneId}/dns_records${params}`);

    return records.map((r) => ({
      id: r.id,
      type: r.type as DnsRecord["type"],
      name: r.name.replace(`.${zone}`, "") || "@",
      content: r.content,
      ttl: r.ttl,
      provider: "cloudflare" as const,
    }));
  }

  async createRecord(zone: string, record: NewDnsRecord): Promise<DnsRecord> {
    const zoneId = await getZoneId(zone);
    const fullName = record.name === "@" ? zone : `${record.name}.${zone}`;

    const created = await cfRequest<CfRecord>("POST", `/zones/${zoneId}/dns_records`, {
      type: record.type,
      name: fullName,
      content: record.content,
      ttl: record.ttl ?? 1, // 1 = auto in Cloudflare
      proxied: false,
    });

    return {
      id: created.id,
      type: created.type as DnsRecord["type"],
      name: created.name.replace(`.${zone}`, "") || "@",
      content: created.content,
      ttl: created.ttl,
      provider: "cloudflare",
    };
  }

  async deleteRecord(zone: string, recordId: string): Promise<void> {
    const zoneId = await getZoneId(zone);
    await cfRequest("DELETE", `/zones/${zoneId}/dns_records/${recordId}`);
  }
}

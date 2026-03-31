import { config, infraConfig } from "../../config";
import type { DnsProvider, DnsRecord, NewDnsRecord } from "./dns.service";

// OVH API requires a signature: $1$SHA1(AppSecret+ConsumerKey+Method+URL+Body+Timestamp)
function ovhSign(method: string, url: string, body: string, timestamp: number): string {
  const toSign = [
    infraConfig.ovhAppSecret,
    infraConfig.ovhConsumerKey,
    method.toUpperCase(),
    url,
    body,
    String(timestamp),
  ].join("+");

  const hash = new Bun.CryptoHasher("sha1").update(toSign).digest("hex");
  return `$1$${hash}`;
}

async function ovhRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${config.ovhApiBase}${path}`;
  const bodyStr = body ? JSON.stringify(body) : "";

  // Get server time for signature
  const timeRes = await fetch(`${config.ovhApiBase}/auth/time`);
  const timestamp = await timeRes.json() as number;

  const signature = ovhSign(method, url, bodyStr, timestamp);

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Ovh-Application": infraConfig.ovhAppKey,
      "X-Ovh-Consumer": infraConfig.ovhConsumerKey,
      "X-Ovh-Timestamp": String(timestamp),
      "X-Ovh-Signature": signature,
    },
    body: bodyStr || undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OVH API ${method} ${path}: ${res.status} ${err}`);
  }

  return res.json() as T;
}

// OVH record detail shape
interface OvhRecord {
  id: number;
  fieldType: string;
  subDomain: string;
  target: string;
  ttl: number;
  zone: string;
}

export class OvhDnsAdapter implements DnsProvider {
  readonly provider = "ovh" as const;

  async getZones(): Promise<string[]> {
    return ovhRequest<string[]>("GET", "/domain/zone");
  }

  async listRecords(zone: string, type?: string): Promise<DnsRecord[]> {
    const params = type ? `?fieldType=${type}` : "";
    const ids = await ovhRequest<number[]>("GET", `/domain/zone/${zone}/record${params}`);

    // Fetch details in parallel (batch of 10)
    const records: DnsRecord[] = [];
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const details = await Promise.all(
        batch.map((id) => ovhRequest<OvhRecord>("GET", `/domain/zone/${zone}/record/${id}`))
      );
      for (const d of details) {
        records.push({
          id: String(d.id),
          type: d.fieldType as DnsRecord["type"],
          name: d.subDomain || "@",
          content: d.target,
          ttl: d.ttl,
          provider: "ovh",
        });
      }
    }

    return records;
  }

  async createRecord(zone: string, record: NewDnsRecord): Promise<DnsRecord> {
    const created = await ovhRequest<OvhRecord>("POST", `/domain/zone/${zone}/record`, {
      fieldType: record.type,
      subDomain: record.name === "@" ? "" : record.name,
      target: record.content,
      ttl: record.ttl ?? 3600,
    });

    // Refresh the zone to apply changes
    await ovhRequest("POST", `/domain/zone/${zone}/refresh`);

    return {
      id: String(created.id),
      type: created.fieldType as DnsRecord["type"],
      name: created.subDomain || "@",
      content: created.target,
      ttl: created.ttl,
      provider: "ovh",
    };
  }

  async deleteRecord(zone: string, recordId: string): Promise<void> {
    await ovhRequest("DELETE", `/domain/zone/${zone}/record/${recordId}`);
    await ovhRequest("POST", `/domain/zone/${zone}/refresh`);
  }
}

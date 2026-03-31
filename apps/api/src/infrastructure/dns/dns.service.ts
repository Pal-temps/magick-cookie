import { infraConfig } from "../../config";
import { OvhDnsAdapter } from "./ovh-dns.adapter";
import { CloudflareDnsAdapter } from "./cf-dns.adapter";

// ─── Types ───

export interface DnsRecord {
  id: string;
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "SRV" | "NS";
  name: string;
  content: string;
  ttl: number;
  provider: "ovh" | "cloudflare";
}

export interface NewDnsRecord {
  type: string;
  name: string;
  content: string;
  ttl?: number;
}

export interface DnsZone {
  name: string;
  provider: "ovh" | "cloudflare";
}

// ─── Provider interface ───

export interface DnsProvider {
  readonly provider: "ovh" | "cloudflare";
  getZones(): Promise<string[]>;
  listRecords(zone: string, type?: string): Promise<DnsRecord[]>;
  createRecord(zone: string, record: NewDnsRecord): Promise<DnsRecord>;
  deleteRecord(zone: string, recordId: string): Promise<void>;
}

// ─── DNS Service (aggregates all providers) ───

export class DnsService {
  private providers: DnsProvider[] = [];
  private zoneCache: Map<string, DnsProvider> = new Map();

  constructor() {
    // Providers are checked lazily based on infraConfig (can be updated at runtime)
  }

  private getActiveProviders(): DnsProvider[] {
    const providers: DnsProvider[] = [];
    if (infraConfig.ovhAppKey && infraConfig.ovhAppSecret && infraConfig.ovhConsumerKey) {
      providers.push(new OvhDnsAdapter());
    }
    if (infraConfig.cfApiToken) {
      providers.push(new CloudflareDnsAdapter());
    }
    return providers;
  }

  async getZones(): Promise<DnsZone[]> {
    const zones: DnsZone[] = [];
    for (const provider of this.getActiveProviders()) {
      const names = await provider.getZones();
      for (const name of names) {
        zones.push({ name, provider: provider.provider });
        this.zoneCache.set(name, provider);
      }
    }
    return zones;
  }

  async detectProvider(zone: string): Promise<DnsProvider | null> {
    if (this.zoneCache.has(zone)) return this.zoneCache.get(zone)!;
    // Refresh cache
    await this.getZones();
    return this.zoneCache.get(zone) ?? null;
  }

  async listRecords(zone: string, type?: string): Promise<DnsRecord[]> {
    const provider = await this.detectProvider(zone);
    if (!provider) throw new Error(`Zone "${zone}" not found in any provider`);
    return provider.listRecords(zone, type);
  }

  async createRecord(zone: string, record: NewDnsRecord): Promise<DnsRecord> {
    const provider = await this.detectProvider(zone);
    if (!provider) throw new Error(`Zone "${zone}" not found in any provider`);
    return provider.createRecord(zone, record);
  }

  async deleteRecord(zone: string, recordId: string): Promise<void> {
    const provider = await this.detectProvider(zone);
    if (!provider) throw new Error(`Zone "${zone}" not found in any provider`);
    return provider.deleteRecord(zone, recordId);
  }
}

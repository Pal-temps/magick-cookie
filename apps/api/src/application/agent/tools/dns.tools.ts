import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { DnsService } from "../../../infrastructure/dns/dns.service";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT"] as const;

export function createDnsTools(dns: DnsService): AgentTool[] {
  return [
    defineTool({
      name: "dns_list_zones",
      description: "Liste toutes les zones DNS disponibles (OVH + Cloudflare). Retourne le nom de chaque zone et son provider.",
      params: z.object({}),
      execute: async () => {
        const zones = await dns.getZones();
        return { count: zones.length, zones };
      },
    }),
    defineTool({
      name: "dns_list_records",
      description: "Liste les enregistrements DNS d'une zone. Peut filtrer par type (A, AAAA, CNAME, MX, TXT).",
      params: z.object({
        zone: z.string().min(1).max(253).describe("Nom de la zone (ex: paltemps.fr)"),
        type: z.enum(RECORD_TYPES).optional().describe("Filtrer par type: A, AAAA, CNAME, MX, TXT (optionnel)"),
      }),
      execute: async ({ zone, type }) => {
        const records = await dns.listRecords(zone, type);
        return { count: records.length, records };
      },
    }),
    defineTool({
      name: "dns_create_record",
      description: "Cree un enregistrement DNS. Detecte automatiquement si la zone est sur OVH ou Cloudflare. Pour creer un sous-domaine, utilise type='A' avec l'IP du serveur.",
      params: z.object({
        zone: z.string().min(1).max(253).describe("Nom de la zone (ex: paltemps.fr)"),
        type: z.enum(RECORD_TYPES).describe("Type: A, AAAA, CNAME, MX, TXT"),
        name: z.string().min(1).max(253).describe("Sous-domaine (ex: 'app' pour app.paltemps.fr, '@' pour la racine)"),
        content: z.string().min(1).max(500).describe("Valeur: IP pour A/AAAA, domaine pour CNAME/MX, texte pour TXT"),
        ttl: z.number().int().min(60).max(86400).optional().describe("TTL en secondes (defaut: 3600)"),
      }),
      execute: async ({ zone, type, name, content, ttl }) => {
        const record = await dns.createRecord(zone, { type, name, content, ttl });
        return { created: true, record };
      },
    }),
    defineTool({
      name: "dns_delete_record",
      description: "Supprime un enregistrement DNS par son ID. Utilise dns_list_records pour trouver l'ID d'abord.",
      params: z.object({
        zone: z.string().min(1).max(253).describe("Nom de la zone"),
        record_id: z.string().min(1).describe("ID de l'enregistrement a supprimer"),
      }),
      // Destructive: flip to "user-confirm" in P4 once permission channel is wired.
      execute: async ({ zone, record_id }) => {
        await dns.deleteRecord(zone, record_id);
        return { deleted: true };
      },
    }),
  ];
}

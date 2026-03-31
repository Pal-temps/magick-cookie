import type { AgentTool } from "../tool-registry";
import type { DnsService } from "../../../infrastructure/dns/dns.service";

export function createDnsTools(dns: DnsService): AgentTool[] {
  return [
    {
      name: "dns_list_zones",
      description: "Liste toutes les zones DNS disponibles (OVH + Cloudflare). Retourne le nom de chaque zone et son provider.",
      parameters: {},
      execute: async () => {
        const zones = await dns.getZones();
        return { count: zones.length, zones };
      },
    },
    {
      name: "dns_list_records",
      description: "Liste les enregistrements DNS d'une zone. Peut filtrer par type (A, AAAA, CNAME, MX, TXT).",
      parameters: {
        zone: { type: "string", description: "Nom de la zone (ex: paltemps.fr)", required: true },
        type: { type: "string", description: "Filtrer par type: A, AAAA, CNAME, MX, TXT (optionnel)", required: false },
      },
      execute: async (params) => {
        const records = await dns.listRecords(params.zone as string, params.type as string | undefined);
        return { count: records.length, records };
      },
    },
    {
      name: "dns_create_record",
      description: "Cree un enregistrement DNS. Detecte automatiquement si la zone est sur OVH ou Cloudflare. Pour creer un sous-domaine, utilise type='A' avec l'IP du serveur.",
      parameters: {
        zone: { type: "string", description: "Nom de la zone (ex: paltemps.fr)", required: true },
        type: { type: "string", description: "Type: A, AAAA, CNAME, MX, TXT", required: true },
        name: { type: "string", description: "Sous-domaine (ex: 'app' pour app.paltemps.fr, '@' pour la racine)", required: true },
        content: { type: "string", description: "Valeur: IP pour A/AAAA, domaine pour CNAME/MX, texte pour TXT", required: true },
        ttl: { type: "number", description: "TTL en secondes (defaut: 3600)", required: false },
      },
      execute: async (params) => {
        const record = await dns.createRecord(params.zone as string, {
          type: params.type as string,
          name: params.name as string,
          content: params.content as string,
          ttl: params.ttl as number | undefined,
        });
        return { created: true, record };
      },
    },
    {
      name: "dns_delete_record",
      description: "Supprime un enregistrement DNS par son ID. Utilise dns_list_records pour trouver l'ID d'abord.",
      parameters: {
        zone: { type: "string", description: "Nom de la zone", required: true },
        record_id: { type: "string", description: "ID de l'enregistrement a supprimer", required: true },
      },
      execute: async (params) => {
        await dns.deleteRecord(params.zone as string, params.record_id as string);
        return { deleted: true };
      },
    },
  ];
}

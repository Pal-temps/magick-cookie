import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createDnsTools } from "../../application/agent/tools/dns.tools";
import type { DnsService } from "../../infrastructure/dns/dns.service";
import type { AgentTool } from "../../application/agent/tool-registry";

describe("dns.tools", () => {
  let svc: { [K in keyof DnsService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listZones: AgentTool;
  let listRecords: AgentTool;
  let createRecord: AgentTool;
  let deleteRecord: AgentTool;

  beforeEach(() => {
    svc = {
      getZones: mock(() => Promise.resolve([])),
      listRecords: mock(() => Promise.resolve([])),
      createRecord: mock(() => Promise.resolve({ id: "r1" } as never)),
      deleteRecord: mock(() => Promise.resolve()),
    } as unknown as { [K in keyof DnsService]: ReturnType<typeof mock> };

    tools = createDnsTools(svc as unknown as DnsService);
    listZones = tools.find((t) => t.name === "dns_list_zones")!;
    listRecords = tools.find((t) => t.name === "dns_list_records")!;
    createRecord = tools.find((t) => t.name === "dns_create_record")!;
    deleteRecord = tools.find((t) => t.name === "dns_delete_record")!;
  });

  it("registers 4 tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "dns_create_record", "dns_delete_record", "dns_list_records", "dns_list_zones",
    ]);
  });

  it("write tools are user-confirm (DNS is public infra + TXT is an exfil vector)", () => {
    expect(createRecord.permissionLevel).toBe("user-confirm");
    expect(deleteRecord.permissionLevel).toBe("user-confirm");
    expect(listZones.permissionLevel).toBe("auto");
    expect(listRecords.permissionLevel).toBe("auto");
  });

  it("dns_list_zones wraps the result with a count", async () => {
    svc.getZones.mockReturnValue(Promise.resolve(["paltemps.fr", "example.com"] as never));
    const result = (await listZones.execute({})) as { count: number; zones: unknown[] };
    expect(result.count).toBe(2);
    expect(result.zones).toEqual(["paltemps.fr", "example.com"]);
  });

  it("dns_list_records forwards zone + optional type", async () => {
    await listRecords.execute({ zone: "paltemps.fr", type: "A" });
    expect(svc.listRecords).toHaveBeenCalledWith("paltemps.fr", "A");
  });

  it("dns_list_records rejects an invalid record type", async () => {
    const result = (await listRecords.execute({ zone: "paltemps.fr", type: "ZZZ" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(svc.listRecords).not.toHaveBeenCalled();
  });

  it("dns_create_record forwards full record payload + ttl", async () => {
    await createRecord.execute({
      zone: "paltemps.fr", type: "A", name: "app", content: "1.2.3.4", ttl: 300,
    });
    const [zone, record] = svc.createRecord.mock.calls[0];
    expect(zone).toBe("paltemps.fr");
    expect(record).toEqual({ type: "A", name: "app", content: "1.2.3.4", ttl: 300 });
  });

  it("dns_create_record rejects ttl out of bounds", async () => {
    const result = (await createRecord.execute({
      zone: "x", type: "A", name: "y", content: "1.2.3.4", ttl: 30,
    })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(svc.createRecord).not.toHaveBeenCalled();
  });

  it("dns_delete_record forwards zone + record_id", async () => {
    await deleteRecord.execute({ zone: "paltemps.fr", record_id: "rec-123" });
    expect(svc.deleteRecord).toHaveBeenCalledWith("paltemps.fr", "rec-123");
  });
});

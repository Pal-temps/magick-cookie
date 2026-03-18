import type { ParsedCalEvent } from "../../domain/caldav/caldav.entity";

function extractField(content: string, field: string): string | null {
  // Handle folded lines (RFC 5545: lines starting with space/tab are continuations)
  const unfolded = content.replace(/\r?\n[ \t]/g, "");
  // Match field with optional parameters (e.g., DTSTART;VALUE=DATE:20240101)
  const regex = new RegExp(`^${field}[;:](.*)$`, "m");
  const match = unfolded.match(regex);
  if (!match) return null;
  // Strip parameters prefix if present (e.g., ";VALUE=DATE:" -> value after last ":")
  const raw = match[1];
  const colonIdx = raw.indexOf(":");
  // If the match already started after ":", colonIdx might be -1 or point to the value
  // The regex captures after the first ; or :, so check if there are more params
  if (match[0].startsWith(field + ";") && colonIdx !== -1) {
    return raw.substring(colonIdx + 1).trim();
  }
  return raw.trim();
}

function parseIcsDate(value: string | null): Date | null {
  if (!value) return null;
  // Format: 20240315T120000Z or 20240315T120000 or 20240315
  const clean = value.replace(/[^0-9T]/g, "");
  if (clean.length >= 8) {
    const year = parseInt(clean.substring(0, 4));
    const month = parseInt(clean.substring(4, 6)) - 1;
    const day = parseInt(clean.substring(6, 8));
    let hour = 0, min = 0, sec = 0;
    if (clean.length >= 15) {
      hour = parseInt(clean.substring(9, 11));
      min = parseInt(clean.substring(11, 13));
      sec = parseInt(clean.substring(13, 15));
    }
    if (value.endsWith("Z")) {
      return new Date(Date.UTC(year, month, day, hour, min, sec));
    }
    return new Date(year, month, day, hour, min, sec);
  }
  return null;
}

export class CalDavConnector {
  async fetchEvents(url: string, username: string, password: string): Promise<ParsedCalEvent[]> {
    const res = await fetch(url, {
      headers: { Authorization: "Basic " + btoa(username + ":" + password) },
    });
    if (!res.ok) throw new Error(`CalDAV error ${res.status}`);
    const ics = await res.text();
    return this.parseIcs(ics);
  }

  parseIcs(ics: string): ParsedCalEvent[] {
    const events: ParsedCalEvent[] = [];
    const blocks = ics.split("BEGIN:VEVENT");
    for (const block of blocks.slice(1)) {
      const end = block.indexOf("END:VEVENT");
      if (end === -1) continue;
      const content = block.substring(0, end);
      events.push({
        uid: extractField(content, "UID") || "",
        summary: extractField(content, "SUMMARY") || "Sans titre",
        dtstart: parseIcsDate(extractField(content, "DTSTART")),
        dtend: parseIcsDate(extractField(content, "DTEND")),
        description: extractField(content, "DESCRIPTION") || null,
        location: extractField(content, "LOCATION") || null,
      });
    }
    return events;
  }

  async testConnection(url: string, username: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: { Authorization: "Basic " + btoa(username + ":" + password) },
      });
      return res.ok || res.status === 207; // 207 Multi-Status is valid for CalDAV
    } catch {
      return false;
    }
  }
}

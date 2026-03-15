export interface ParsedEventData {
  title: string;
  startAt: Date | null;
  endAt: Date | null;
  location: string | null;
  isAllDay: boolean;
}

const DAYS_FR: Record<string, number> = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4,
  vendredi: 5, samedi: 6, dimanche: 0,
};

const MONTHS_FR: Record<string, number> = {
  janvier: 0, fevrier: 1, "février": 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, "août": 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, "décembre": 11, decembre: 11,
};

const TIME_WORDS: Record<string, [number, number]> = {
  matin: [9, 12],
  midi: [12, 13],
  "après-midi": [14, 17],
  "apres-midi": [14, 17],
  soir: [19, 21],
};

export function parseEventFromText(text: string, referenceDate: Date = new Date()): ParsedEventData {
  let remaining = text.trim();
  const lower = remaining.toLowerCase();

  // --- Extract times ---
  let startHour: number | null = null;
  let startMin = 0;
  let endHour: number | null = null;
  let endMin = 0;

  // Pattern: "de 10h a 12h30", "de 10h30 a 12h"
  const rangeRe = /\bde\s+(\d{1,2})\s*[hH]\s*(\d{0,2})\s*[àa]\s*(\d{1,2})\s*[hH]\s*(\d{0,2})\b/i;
  let m = lower.match(rangeRe);
  if (m) {
    startHour = parseInt(m[1]);
    startMin = m[2] ? parseInt(m[2]) : 0;
    endHour = parseInt(m[3]);
    endMin = m[4] ? parseInt(m[4]) : 0;
    remaining = remaining.replace(new RegExp(rangeRe.source, "i"), "");
  }

  if (startHour === null) {
    // Pattern: "10h30 - 12h", "10h a 12h"
    const rangeRe2 = /\b(\d{1,2})\s*[hH]\s*(\d{0,2})\s*[-–àa]\s*(\d{1,2})\s*[hH]\s*(\d{0,2})\b/i;
    m = lower.match(rangeRe2);
    if (m) {
      startHour = parseInt(m[1]);
      startMin = m[2] ? parseInt(m[2]) : 0;
      endHour = parseInt(m[3]);
      endMin = m[4] ? parseInt(m[4]) : 0;
      remaining = remaining.replace(new RegExp(rangeRe2.source, "i"), "");
    }
  }

  if (startHour === null) {
    // Pattern: "a 14h30", "à 10h"
    const singleRe = /\b[àa]\s+(\d{1,2})\s*[hH]\s*(\d{0,2})\b/i;
    m = lower.match(singleRe);
    if (m) {
      startHour = parseInt(m[1]);
      startMin = m[2] ? parseInt(m[2]) : 0;
      remaining = remaining.replace(new RegExp(singleRe.source, "i"), "");
    }
  }

  if (startHour === null) {
    // Standalone time: "14h30"
    const standaloneRe = /\b(\d{1,2})\s*[hH]\s*(\d{1,2})?\b/;
    m = lower.match(standaloneRe);
    if (m) {
      startHour = parseInt(m[1]);
      startMin = m[2] ? parseInt(m[2]) : 0;
      remaining = remaining.replace(new RegExp(standaloneRe.source), "");
    }
  }

  // Default end = start + 1h if no end specified
  if (startHour !== null && endHour === null) {
    endHour = startHour + 1;
    endMin = startMin;
  }

  // --- Extract time-of-day words ---
  let isAllDay = false;
  if (startHour === null) {
    for (const [word, [sh, eh]] of Object.entries(TIME_WORDS)) {
      if (lower.includes(word)) {
        startHour = sh;
        startMin = 0;
        endHour = eh;
        endMin = 0;
        remaining = remaining.replace(new RegExp(word, "i"), "");
        break;
      }
    }
  }

  // --- Extract date ---
  let targetDate: Date | null = null;

  // "demain"
  if (/\bdemain\b/i.test(lower)) {
    targetDate = new Date(referenceDate);
    targetDate.setDate(targetDate.getDate() + 1);
    remaining = remaining.replace(/\bdemain\b/i, "");
  }
  // "apres-demain" / "après-demain"
  else if (/\bapr[eè]s[- ]demain\b/i.test(lower)) {
    targetDate = new Date(referenceDate);
    targetDate.setDate(targetDate.getDate() + 2);
    remaining = remaining.replace(/\bapr[eè]s[- ]demain\b/i, "");
  }
  // "aujourd'hui"
  else if (/\baujourd'?hui\b/i.test(lower)) {
    targetDate = new Date(referenceDate);
    remaining = remaining.replace(/\baujourd'?hui\b/i, "");
  }

  // Day names: "lundi", "vendredi prochain"
  if (!targetDate) {
    for (const [dayName, dayNum] of Object.entries(DAYS_FR)) {
      const dayRe = new RegExp(`\\b${dayName}(?:\\s+prochain)?\\b`, "i");
      if (dayRe.test(lower)) {
        targetDate = nextWeekday(referenceDate, dayNum);
        remaining = remaining.replace(dayRe, "");
        break;
      }
    }
  }

  // "le 15 mars", "le 15/03"
  if (!targetDate) {
    // "le 15 mars"
    const dateWordRe = /\ble\s+(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\b/i;
    m = lower.match(dateWordRe);
    if (m) {
      const day = parseInt(m[1]);
      const monthKey = m[2].toLowerCase().replace("û", "u").replace("é", "e");
      const month = MONTHS_FR[monthKey] ?? 0;
      targetDate = new Date(referenceDate.getFullYear(), month, day);
      if (targetDate < referenceDate) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }
      remaining = remaining.replace(new RegExp(dateWordRe.source, "i"), "");
    }
  }

  if (!targetDate) {
    // "le 15/03"
    const dateSlashRe = /\ble\s+(\d{1,2})[/.](\d{1,2})\b/i;
    m = lower.match(dateSlashRe);
    if (m) {
      const day = parseInt(m[1]);
      const month = parseInt(m[2]) - 1;
      targetDate = new Date(referenceDate.getFullYear(), month, day);
      if (targetDate < referenceDate) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }
      remaining = remaining.replace(new RegExp(dateSlashRe.source, "i"), "");
    }
  }

  // Default to today if no date found
  if (!targetDate) {
    targetDate = new Date(referenceDate);
  }

  // --- Build start/end dates ---
  let startAt: Date | null = null;
  let endAt: Date | null = null;

  if (startHour !== null && endHour !== null) {
    startAt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), startHour, startMin);
    endAt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), endHour!, endMin);
  } else {
    // No time specified — all day event
    isAllDay = true;
    startAt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0);
    endAt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59);
  }

  // --- Extract location ---
  let location: string | null = null;
  const locRe = /\b(?:au|chez)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)/;
  const locMatch = remaining.match(locRe);
  if (locMatch) {
    location = locMatch[0].trim();
    // Don't remove "chez X" from title — it's often part of the event name
  }

  // --- Build title from what remains ---
  let title = remaining
    .replace(/\s+/g, " ")
    .replace(/^\s*[-,]+\s*/, "")
    .replace(/\s*[-,]+\s*$/, "")
    .trim();

  // Clean up leading/trailing prepositions
  title = title.replace(/^\s*(de|du|le|la|les|pour)\s+/i, "").trim();

  if (!title) {
    title = "Evenement";
  }

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, startAt, endAt, location, isAllDay };
}

function nextWeekday(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const currentDay = result.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  result.setDate(result.getDate() + diff);
  return result;
}

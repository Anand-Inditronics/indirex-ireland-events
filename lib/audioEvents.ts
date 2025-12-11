// lib/audioEvents.ts
export type RawDetails = Record<string, any>;

export interface AudioEventRow {
  id?: number | string; // DB PK (optional)
  device_id: string | null;
  ts: number | string | null; // stored big int / epoch or string
  type: number | null;
  details: RawDetails | null; // jsonb
}

export interface AudioEvent {
  device_id: string | null;
  ts_raw: number | string | null; // original raw ts from DB
  ts_iso: string | null; // normalized ISO string for UI
  type: number | null;
  details: RawDetails | null;
  // keep rawRow in case UI wants more fields
  rawRow?: AudioEventRow;
}

/** Coerce numeric/string epoch (seconds or ms) or yyyyMMdd_HHmmss to ISO */
export function parseAnyTimestampToISO(v: any): string | null {
  if (v === undefined || v === null) return null;
  // number
  if (typeof v === "number") {
    const ms = v < 1e11 ? v * 1000 : v; // seconds -> ms
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string") {
    const s = v.trim();
    // yyyyMMdd_HHmmss
    if (/^\d{8}_\d{6}$/.test(s)) {
      const [date, time] = s.split("_");
      const year = date.slice(0, 4);
      const month = date.slice(4, 6);
      const day = date.slice(6, 8);
      const hour = time.slice(0, 2);
      const minute = time.slice(2, 4);
      const second = time.slice(4, 6);
      const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    // numeric string
    if (/^-?\d+$/.test(s)) {
      const n = Number(s);
      const ms = s.length <= 10 ? n * 1000 : n;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    // try parse
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  try {
    const coerced = Number(v);
    if (!isNaN(coerced)) {
      const ms = coerced < 1e11 ? coerced * 1000 : coerced;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
  } catch {}
  return null;
}

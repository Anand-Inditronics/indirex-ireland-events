// app/api/audio-events/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db"; // your db helper
import { parseAnyTimestampToISO } from "@/lib/audioEvents";

/**
 * Server-side route: returns only events for IM000200 & IM000131 by default.
 * Accepts query params:
 * - meter_id: optional, single id or comma-separated list -> further filter which device_ids to return
 * - type (default 42)
 * - start, end (ISO string)
 * - limit (default 50), offset (default 0)
 * - count=true to return total count
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    // meter_id may be provided by client to select one of the two IDs or others
    const meterIdParam = q.get("meter_id") ?? null;
    const start = q.get("start") ?? null;
    const end = q.get("end") ?? null;
    const limit = Math.min(1000, Number(q.get("limit") ?? 50) || 50);
    const offset = Number(q.get("offset") ?? 0) || 0;
    const typeFilter = q.get("type") ?? "42";

    // default allowed device ids (server enforces)
    const DEFAULT_DEVICE_IDS = ["IM000200", "IM000131"];

    // Build WHERE & params
    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;

    // type
    if (typeFilter) {
      where.push(`type = $${idx++}`);
      params.push(Number(typeFilter));
    }

    // device_id filtering:
    // - if meter_id provided: support comma-separated list -> filter by those values (but still intersect with default allowed set)
    // - else: filter by DEFAULT_DEVICE_IDS
    const requestedDeviceIds: string[] | null = meterIdParam
      ? meterIdParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    // Determine final device list: if requested provided, intersect with allowed defaults
    const finalDeviceIds =
      requestedDeviceIds && requestedDeviceIds.length > 0
        ? requestedDeviceIds.filter((id) => DEFAULT_DEVICE_IDS.includes(id))
        : DEFAULT_DEVICE_IDS;

    if (finalDeviceIds.length === 0) {
      // nothing to return
      return NextResponse.json({ items: [], total: 0, limit, offset });
    }

    // use ANY($n::text[]) for array param
    where.push(`device_id = ANY($${idx++}::text[])`);
    params.push(finalDeviceIds);

    // start / end range on ts (normalize seconds vs ms)
    if (start) {
      where.push(
        `(
          to_timestamp(CASE WHEN ts > 99999999999 THEN ts/1000.0 ELSE ts END) AT TIME ZONE 'UTC'
        ) >= $${idx++}`
      );
      params.push(new Date(start).toISOString());
    }
    if (end) {
      where.push(
        `(
          to_timestamp(CASE WHEN ts > 99999999999 THEN ts/1000.0 ELSE ts END) AT TIME ZONE 'UTC'
        ) <= $${idx++}`
      );
      params.push(new Date(end).toISOString());
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT id, device_id, ts, type, details
      FROM meter_audio_events
      ${whereSql}
      ORDER BY CASE WHEN ts > 99999999999 THEN (ts/1000.0) ELSE ts END DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const res = await query(sql, params);
    const rows = res.rows ?? [];

    const items = rows.map((r: any) => {
      const tsRaw = r.ts;
      const tsIso = parseAnyTimestampToISO(tsRaw);
      return {
        device_id: r.device_id,
        ts_raw: tsRaw,
        ts_iso: tsIso,
        type: r.type,
        details: r.details ?? null,
        rawRow: r,
      };
    });

    const includeCount = q.get("count") === "true";
    if (includeCount) {
      // count using same where clause; reuse params for left part (exclude limit/offset, which are last two)
      const countParams = params.slice(0, params.length - 2);
      const countRes = await query(
        `SELECT count(*) AS total FROM meter_audio_events ${whereSql}`,
        countParams
      );
      const total = Number(countRes.rows?.[0]?.total ?? 0);
      return NextResponse.json({ items, total, limit, offset });
    }

    return NextResponse.json({ items, limit, offset });
  } catch (err: any) {
    console.error("api/audio-events error:", err);
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

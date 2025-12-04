// app/api/audio-events/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.AUDIO_EVENTS_TABLE || process.env.DYNAMODB_TABLE;
const REGION = process.env.AWS_REGION || "us-east-1";
// Safety cap to avoid infinite memory growth / huge Dynamo costs.
// Set to "0" to disable cap (not recommended).
const MAX_ITEMS_TO_FETCH = Number(process.env.MAX_ITEMS_TO_FETCH ?? "100000");

if (!TABLE) {
  console.warn(
    "AUDIO_EVENTS_TABLE not set. API will error at runtime if used without setting table name."
  );
}

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

/** Helper: try to coerce common timestamp shapes to a Date (or null) */
function parseTimestampToDate(v: any): Date | null {
  if (v === undefined || v === null) return null;

  // numbers: seconds or milliseconds
  if (typeof v === "number") {
    const ms = v < 1e11 ? v * 1000 : v; // seconds -> ms heuristic
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // strings
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
      return isNaN(d.getTime()) ? null : d;
    }

    // numeric string epoch
    if (/^-?\d+$/.test(s)) {
      const n = Number(s);
      const ms = s.length <= 10 ? n * 1000 : n;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    // try ISO / other parseable formats
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // try numeric coercion from other wrapper types
  try {
    const coerced = Number(v);
    if (!isNaN(coerced)) {
      const ms = coerced < 1e11 ? coerced * 1000 : coerced;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch {
    // ignore
  }

  return null;
}

/** Normalize raw Dynamo item into the structure client expects */
function normalizeItem(it: Record<string, any>) {
  // prefer common timestamp field names
  const timestampCandidates = [
    it.timestamp_meter,
    it.timestamp_meter_iso,
    it.timestamp_meter_epoch,
    it.ts_meter,
    it.meter_ts,
    it.timestamp,
  ];

  // find the first usable timestamp value
  const rawTs = timestampCandidates.find((v) => v !== undefined && v !== null);
  // produce a stable id (prefer an existing id or pk)
  const baseId =
    it.id ??
    it.pk ??
    it.pk_id ??
    it.pk1 ??
    (it.meter_id ? String(it.meter_id) : undefined) ??
    undefined;
  const id = baseId
    ? `${baseId}_${String(rawTs ?? Math.random().toString(36).slice(2, 9))}`
    : String(Math.random().toString(36).slice(2, 12));

  return {
    id,
    meter_id: it.meter_id ?? null,
    fp_file: it.fp_file ?? null,
    channel: it.channel ?? null,
    hit_score:
      typeof it.hit_score === "number"
        ? it.hit_score
        : it.hit_score
        ? Number(it.hit_score)
        : null,
    recorder_id: it.recorder_id ?? null,
    source_type: it.source_type ?? null,
    // raw timestamp value (may be string/number). We'll also expose parsed ISO for convenience.
    timestamp_meter_raw: rawTs ?? null,
    timestamp_meter_iso: (() => {
      const d = parseTimestampToDate(rawTs);
      return d ? d.toISOString() : null;
    })(),
    timestamp_recorder_raw: it.timestamp_recorder ?? it.ts_recorder ?? null,
    raw: it,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const fetchAll = q.get("fetchAll") === "true" || q.get("all") === "true"; // flag to fetch all pages
    const limitParam = Number(q.get("limit") ?? "50") || 50;

    // Basic single-page mode: return a single scan page (default behaviour)
    if (!fetchAll) {
      // accept start token? this route supports ExclusiveStartKey via `start` param if needed,
      // but main use-case here is fetchAll=true. We'll implement simple single-scan behavior.
      const startToken = q.get("start");
      let exclusiveStartKey = undefined;
      if (startToken) {
        try {
          exclusiveStartKey = JSON.parse(
            Buffer.from(startToken, "base64").toString("utf8")
          );
        } catch {
          exclusiveStartKey = undefined;
        }
      }

      const res = await ddb.send(
        new ScanCommand({
          TableName: TABLE!,
          Limit: limitParam,
          ExclusiveStartKey: exclusiveStartKey ?? undefined,
        })
      );

      const items = (res.Items ?? []).map(normalizeItem);
      // Sort newest-first by parsed ISO
      items.sort((a, b) => {
        const da = a.timestamp_meter_iso
          ? new Date(a.timestamp_meter_iso).getTime()
          : 0;
        const db = b.timestamp_meter_iso
          ? new Date(b.timestamp_meter_iso).getTime()
          : 0;
        return db - da;
      });

      return NextResponse.json({
        items,
        nextStart: res.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
          : null,
      });
    }

    // ----------------------------
    // FETCH ALL MODE (iterative scan)
    // ----------------------------
    if (!TABLE) {
      return NextResponse.json(
        { error: "AUDIO_EVENTS_TABLE env var not set" },
        { status: 500 }
      );
    }

    const accumulated: Record<string, any>[] = [];
    let exclusiveStartKey: any = undefined;
    let pagesFetched = 0;

    while (true) {
      const res = await ddb.send(
        new ScanCommand({
          TableName: TABLE,
          ExclusiveStartKey: exclusiveStartKey ?? undefined,
          // You can reduce the size per request by setting a smaller Limit here
          // but to fetch all items we iterate until LastEvaluatedKey === undefined
          Limit: 1000, // fetch in chunks of 1000 items (tuneable)
        })
      );

      pagesFetched++;
      const pageItems = res.Items ?? [];
      for (const it of pageItems) accumulated.push(it);

      // Safety guard
      if (MAX_ITEMS_TO_FETCH > 0 && accumulated.length >= MAX_ITEMS_TO_FETCH) {
        console.warn(
          `Reached MAX_ITEMS_TO_FETCH=${MAX_ITEMS_TO_FETCH}, stopping early.`
        );
        break;
      }

      if (!res.LastEvaluatedKey) {
        break; // finished
      }
      exclusiveStartKey = res.LastEvaluatedKey;
    }

    // Normalize & sort newest-first by parsed timestamp
    const normalized = accumulated.map(normalizeItem);
    normalized.sort((a, b) => {
      const da = a.timestamp_meter_iso
        ? new Date(a.timestamp_meter_iso).getTime()
        : 0;
      const db = b.timestamp_meter_iso
        ? new Date(b.timestamp_meter_iso).getTime()
        : 0;
      return db - da;
    });

    return NextResponse.json({
      items: normalized,
      count: normalized.length,
      pagesFetched,
      note:
        MAX_ITEMS_TO_FETCH > 0
          ? `Returned up to MAX_ITEMS_TO_FETCH=${MAX_ITEMS_TO_FETCH} items (you can change with env MAX_ITEMS_TO_FETCH=0 to disable cap).`
          : "Returned all items (no cap set).",
    });
  } catch (err: any) {
    console.error("api/audio-events fetchAll error:", err);
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// app/api/events/export-csv/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { mapMeterEventRow } from "@/lib/meterEvents";

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/"/g, '""');
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str}"`
    : str;
}

function flattenDetection(arr: any[] | undefined): string {
  if (!arr || !arr.length) return "";
  return arr
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        return JSON.stringify(item);
      }
      return String(item);
    })
    .join(" | ");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const deviceId = searchParams.get("deviceId")?.trim();
  const date = searchParams.get("date");
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");
  const detectionTypes = searchParams.get("detectionTypes")
    ? searchParams.get("detectionTypes")!.split(",")
    : [];

  const where: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (deviceId) {
    where.push(`LOWER(device_id) LIKE LOWER($${idx++})`);
    values.push(`%${deviceId}%`);
  }

  if (date) {
    const base = new Date(date);
    const start = startTime
      ? new Date(`${date}T${startTime}:00`)
      : new Date(base.setHours(0, 0, 0, 0));
    const end = endTime
      ? new Date(`${date}T${endTime}:59.999`)
      : new Date(base.setHours(23, 59, 59, 999));

    where.push(`timestamp >= $${idx++}`);
    values.push(Math.floor(start.getTime() / 1000));
    where.push(`timestamp <= $${idx++}`);
    values.push(Math.floor(end.getTime() / 1000));
  }

  if (detectionTypes.length > 0) {
    const conds = detectionTypes.map((t) => {
      return `(detections->'${t}' IS NOT NULL AND jsonb_array_length(detections->'${t}') > 0)`;
    });
    where.push(`(${conds.join(" OR ")})`);
  }

  const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

  const sql = `
    SELECT device_id, timestamp, status, detections, processed_s3_key
    FROM meter_image_events
    ${whereClause}
    ORDER BY timestamp DESC
  `;

  const res = await query(sql, values);
  const rows = res.rows.map(mapMeterEventRow);

  // Stream CSV
  const headers = [
    "Device ID",
    "Timestamp",
    "Status",
    "OCR",
    "Faces",
    "TV Channel",
    "Object Detection",
    "Content Detection",
    "Processed Image URL",
  ];

  const csvRows = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.deviceId,
        new Date(r.timestamp * 1000).toISOString(),
        r.status,
        escapeCSV(flattenDetection(r.detections.OCR)),
        escapeCSV(flattenDetection(r.detections.faces)),
        escapeCSV(flattenDetection(r.detections.tv_channel)),
        escapeCSV(flattenDetection(r.detections.object_detection)),
        escapeCSV(flattenDetection(r.detections.content_detection)),
        r.processedS3Key || "",
      ]
        .map(escapeCSV)
        .join(",")
    ),
  ];

  const csvContent = csvRows.join("\r\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="meter-events-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
    },
  });
}

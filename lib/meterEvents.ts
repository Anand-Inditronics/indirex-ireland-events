// lib/meterEvents.ts

export interface Detections {
  OCR: any[];
  faces: any[];
  tv_channel: any[];
  object_detection: any[];
  content_detection: any[];
}

export interface MeterEvent {
  deviceId: string;
  timestamp: number; // bigint from DB
  status: string | null;
  detections: Detections;
  processedS3Key: string | null;
}

function normalizeDetections(raw: any): Detections {
  const d = raw || {};
  return {
    OCR: Array.isArray(d.OCR) ? d.OCR : [],
    faces: Array.isArray(d.faces) ? d.faces : [],
    tv_channel: Array.isArray(d.tv_channel) ? d.tv_channel : [],
    object_detection: Array.isArray(d.object_detection)
      ? d.object_detection
      : [],
    content_detection: Array.isArray(d.content_detection)
      ? d.content_detection
      : [],
  };
}

export function mapMeterEventRow(row: any): MeterEvent {
  return {
    deviceId: String(row.device_id),
    timestamp: Number(row.timestamp),
    status: row.status ?? null,
    detections: normalizeDetections(row.detections),
    processedS3Key: row.processed_s3_key ?? null,
  };
}

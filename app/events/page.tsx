// app/events/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";

import { query } from "../../lib/db";
import { mapMeterEventRow, MeterEvent } from "../../lib/meterEvents";
import MeterEventsTable from "../../components/ui/MeterEventsTable";

export const dynamicParams = true;
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    deviceId?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    detectionTypes?: string;
  }>;
}

export default async function EventsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page || "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Build WHERE clauses based on filters
  const whereClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  // Device ID filter
  if (params.deviceId) {
    whereClauses.push(`LOWER(device_id) LIKE LOWER($${paramIndex})`);
    queryParams.push(`%${params.deviceId}%`);
    paramIndex++;
  }

  // Date and time filters
  if (params.date) {
    const filterDate = new Date(params.date);

    if (params.startTime || params.endTime) {
      // If time range is specified, use it
      const startDateTime = params.startTime
        ? new Date(`${params.date}T${params.startTime}:00`)
        : new Date(filterDate.setHours(0, 0, 0, 0));

      const endDateTime = params.endTime
        ? new Date(`${params.date}T${params.endTime}:59`)
        : new Date(filterDate.setHours(23, 59, 59, 999));

      whereClauses.push(`timestamp >= $${paramIndex}`);
      queryParams.push(Math.floor(startDateTime.getTime() / 1000));
      paramIndex++;

      whereClauses.push(`timestamp <= $${paramIndex}`);
      queryParams.push(Math.floor(endDateTime.getTime() / 1000));
      paramIndex++;
    } else {
      // Just filter by date (entire day)
      const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));

      whereClauses.push(`timestamp >= $${paramIndex}`);
      queryParams.push(Math.floor(startOfDay.getTime() / 1000));
      paramIndex++;

      whereClauses.push(`timestamp <= $${paramIndex}`);
      queryParams.push(Math.floor(endOfDay.getTime() / 1000));
      paramIndex++;
    }
  }

  // Detection types filter - we'll check if ANY of the selected types have data
  const detectionTypes = params.detectionTypes
    ? params.detectionTypes.split(",")
    : [];

  if (detectionTypes.length > 0) {
    const detectionConditions = detectionTypes.map((type) => {
      return `(detections->'${type}' IS NOT NULL AND jsonb_array_length(detections->'${type}') > 0)`;
    });
    whereClauses.push(`(${detectionConditions.join(" OR ")})`);
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Add LIMIT and OFFSET to queryParams
  queryParams.push(PAGE_SIZE);
  const limitParamIndex = paramIndex++;
  queryParams.push(offset);
  const offsetParamIndex = paramIndex;

  // Execute queries
  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT device_id, timestamp, status, detections, processed_s3_key
       FROM meter_image_events
       ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      queryParams
    ),
    query(
      `SELECT COUNT(*)::int AS count 
       FROM meter_image_events
       ${whereClause}`,
      queryParams.slice(0, -2) // Remove LIMIT and OFFSET params for count
    ),
  ]);

  const events: MeterEvent[] = rowsRes.rows.map(mapMeterEventRow);
  const total = Number(countRes.rows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meter Image Events</h1>
          <p className="text-sm text-gray-600">
            Showing page {page} of {totalPages} ({total} total events)
          </p>
        </div>
      </div>

      <MeterEventsTable
        data={events}
        initialFilters={{
          deviceId: params.deviceId || "",
          date: params.date || "",
          startTime: params.startTime || "",
          endTime: params.endTime || "",
          detectionTypes: detectionTypes,
        }}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        searchParams={params}
      />
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: any;
}) {
  if (totalPages <= 1) return null;

  // Preserve all search params except page
  const buildQuery = (newPage: number) => {
    const params = new URLSearchParams();
    params.set("page", newPage.toString());

    if (searchParams.deviceId) params.set("deviceId", searchParams.deviceId);
    if (searchParams.date) params.set("date", searchParams.date);
    if (searchParams.startTime) params.set("startTime", searchParams.startTime);
    if (searchParams.endTime) params.set("endTime", searchParams.endTime);
    if (searchParams.detectionTypes)
      params.set("detectionTypes", searchParams.detectionTypes);

    return `?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <Link
        href={buildQuery(currentPage - 1)}
        className={
          currentPage === 1
            ? "pointer-events-none opacity-50"
            : "hover:underline"
        }
      >
        ← Previous
      </Link>

      <span className="text-sm">
        Page {currentPage} of {totalPages}
      </span>

      <Link
        href={buildQuery(currentPage + 1)}
        className={
          currentPage === totalPages
            ? "pointer-events-none opacity-50"
            : "hover:underline"
        }
      >
        Next →
      </Link>
    </div>
  );
}

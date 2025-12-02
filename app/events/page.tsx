// app/events/page.tsx (or page.tsx)

import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";

import { query } from "../../lib/db";
import { mapMeterEventRow, MeterEvent } from "../../lib/meterEvents";
import MeterEventsTable from "../../components/ui/MeterEventsTable";

// THIS IS THE KEY LINE IN 2025
export const dynamicParams = true; // ← without this, searchParams is always {}
export const dynamic = "force-dynamic"; // ← keep this if you want fresh data every time
// revalidate = 0 is not needed anymore

const PAGE_SIZE = 10;

interface PageProps {
  searchParams: Promise<{
    // ← also changed to Promise in Next.js 15
    page?: string;
  }>;
}

export default async function EventsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/signin");
  }

  // Next.js 15: searchParams is now a Promise!
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT device_id,
              timestamp,
              status,
              detections,
              processed_s3_key
       FROM meter_image_events
       ORDER BY timestamp DESC
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset]
    ),
    query(`SELECT COUNT(*)::int AS count FROM meter_image_events`),
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

      <MeterEventsTable data={events} />

      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <Link
        href={{ query: { page: currentPage - 1 } }}
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
        href={{ query: { page: currentPage + 1 } }}
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

// components/AudioEventsTable.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AudioEventRow = {
  id?: number | string;
  device_id?: string | null;
  ts_raw?: number | string | null;
  ts_iso?: string | null;
  type?: number | null;
  details?: any;
  rawRow?: any;
};

export default function AudioEventsTable() {
  const [meterId, setMeterId] = useState<string>("");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const pollRef = useRef<number | null>(null);

  const [items, setItems] = useState<AudioEventRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    fetched: number;
    totalUnknown: boolean;
  } | null>(null);

  const offset = useMemo(
    () => (currentPage - 1) * rowsPerPage,
    [currentPage, rowsPerPage]
  );
  const totalPages = useMemo(() => {
    if (!total) return 1;
    return Math.max(1, Math.ceil(total / rowsPerPage));
  }, [total, rowsPerPage]);

  // ── Timestamp & Params ─────────────────────────────────────────────────────
  function parseAnyToDate(v: any): Date | null {
    if (!v) return null;
    if (typeof v === "number") return new Date(v < 1e11 ? v * 1000 : v);
    if (typeof v === "string") {
      if (/^\d{8}_\d{6}$/.test(v)) {
        const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(
          6,
          8
        )}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}Z`;
        return new Date(iso);
      }
      return new Date(v);
    }
    return null;
  }

  function formatTimestamp(v: any) {
    if (!v) return "-";
    const d =
      typeof v === "string" && v.endsWith("Z")
        ? new Date(v)
        : parseAnyToDate(v);
    return d ? format(d, "yyyy-MM-dd HH:mm:ss") : "-";
  }

  function buildParams(
    count = true,
    override?: { limit?: number; offset?: number }
  ) {
    const p = new URLSearchParams();
    p.set("limit", String(override?.limit ?? rowsPerPage));
    p.set("offset", String(override?.offset ?? offset));
    p.set("type", "42");
    if (meterId.trim()) p.set("meter_id", meterId.trim());
    if (dateRangeStart)
      p.set("start", new Date(`${dateRangeStart}T00:00:00Z`).toISOString());
    if (dateRangeEnd)
      p.set("end", new Date(`${dateRangeEnd}T23:59:59Z`).toISOString());
    if (count) p.set("count", "true");
    return p.toString();
  }

  async function fetchData(opts?: { abortSignal?: AbortSignal }) {
    setLoading(true);
    setLastError(null);
    try {
      const res = await fetch(`/api/audio-events?${buildParams(true)}`, {
        cache: "no-store",
        signal: opts?.abortSignal,
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error || res.statusText
        );
      const json = await res.json();
      const fetched: AudioEventRow[] = (json.items || []).map((it: any) => ({
        id:
          it.rawRow?.id ??
          `${it.device_id ?? "unknown"}_${it.ts_raw ?? Date.now()}`,
        device_id: it.device_id ?? null,
        ts_raw: it.ts_raw ?? it.ts ?? it.ts_iso ?? null,
        ts_iso: it.ts_iso ?? null,
        type: it.type ?? null,
        details: it.details ?? null,
        rawRow: it.rawRow ?? it,
      }));
      setItems(fetched);
      setTotal(typeof json.total === "number" ? json.total : null);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error(err);
        setLastError(err.message || String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData({ abortSignal: ctrl.signal });
    return () => ctrl.abort();
  }, [meterId, dateRangeStart, dateRangeEnd, rowsPerPage, currentPage]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!autoRefresh) return;
    fetchData();
    const id = window.setInterval(() => {
      setIsRefreshing(true);
      fetchData().finally(() => setIsRefreshing(false));
    }, 30_000);
    pollRef.current = id;
    return () => clearInterval(id);
  }, [
    autoRefresh,
    meterId,
    dateRangeStart,
    dateRangeEnd,
    rowsPerPage,
    currentPage,
  ]);

  const InlineDetails = ({
    details,
    rawRow,
  }: {
    details: any;
    rawRow: any;
  }) => {
    const data = details ?? rawRow ?? {};
    if (!data || (typeof data === "object" && Object.keys(data).length === 0))
      return <span className="text-muted-foreground">-</span>;

    const entries = Object.entries(data)
      .filter(([_, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => ({
        key: k,
        value: typeof v === "object" ? JSON.stringify(v, null, 2) : String(v),
      }));

    const visible = entries.slice(0, 3);
    const more = entries.length - 3;

    return (
      <div className="text-sm leading-relaxed">
        {visible.map((e, i) => (
          <div key={i}>
            <span className="font-medium text-muted-foreground">{e.key}:</span>{" "}
            <span className="text-foreground">{e.value}</span>
          </div>
        ))}
        {more > 0 && (
          <div className="text-primary font-medium text-xs">+{more} more</div>
        )}
      </div>
    );
  };

  const HoverDetails = ({ details, rawRow }: { details: any; rawRow: any }) => {
    const data = details ?? rawRow ?? {};
    const entries = Object.entries(data).filter(
      ([_, v]) => v !== null && v !== undefined && v !== ""
    );

    if (entries.length === 0)
      return <p className="text-muted-foreground">No details</p>;

    return (
      <div className="space-y-3 text-xs">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-4 gap-2">
            <div className="font-medium text-muted-foreground col-span-1">
              {key}
            </div>
            <div className="col-span-3 break-all">
              {typeof value === "object" ? (
                <pre className="bg-muted p-2 rounded text-[11px] overflow-x-auto">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                String(value)
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const PaginationComponent = () => {
    const getPageNumbers = () => {
      const pages: (number | "ellipsis")[] = [];
      const showEllipsisStart = currentPage > 3;
      const showEllipsisEnd = currentPage < totalPages - 2;

      pages.push(1);

      if (showEllipsisStart) {
        pages.push("ellipsis");
      } else if (totalPages > 1) {
        pages.push(2);
      }

      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (showEllipsisEnd) {
        pages.push("ellipsis");
      } else if (totalPages > 2 && !pages.includes(totalPages - 1)) {
        pages.push(totalPages - 1);
      }

      if (totalPages > 1 && !pages.includes(totalPages)) {
        pages.push(totalPages);
      }

      return pages;
    };

    return (
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {items.length} of {total ?? "?"} rows
        </div>

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={cn(
                    currentPage === 1 && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>

              {getPageNumbers().map((pageNum, idx) => (
                <PaginationItem key={idx}>
                  {pageNum === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={pageNum === currentPage}
                    >
                      {pageNum}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((p) => (p < totalPages ? p + 1 : p))
                  }
                  className={cn(
                    currentPage >= totalPages &&
                      "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    );
  };

  // ── CSV Export logic ───────────────────────────────────────────────────────
  // Pages through the API using current filters and accumulates results.
  // Uses pageSize=1000 per fetch (server route limits still apply).
  async function exportCsv() {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress({ fetched: 0, totalUnknown: true });
    try {
      const pageSize = 1000;
      let all: AudioEventRow[] = [];
      let pageOffset = 0;
      while (true) {
        // fetch a page (count=false for speed)
        const params = buildParams(false, {
          limit: pageSize,
          offset: pageOffset,
        });
        const res = await fetch(`/api/audio-events?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(
            json.error || res.statusText || "Export fetch failed"
          );
        }
        const json = await res.json();
        const fetched: AudioEventRow[] = (json.items || []).map((it: any) => ({
          id:
            it.rawRow?.id ??
            `${it.device_id ?? "unknown"}_${it.ts_raw ?? Date.now()}`,
          device_id: it.device_id ?? null,
          ts_raw: it.ts_raw ?? it.ts ?? it.ts_iso ?? null,
          ts_iso: it.ts_iso ?? null,
          type: it.type ?? null,
          details: it.details ?? null,
          rawRow: it.rawRow ?? it,
        }));
        all = all.concat(fetched);
        setExportProgress({
          fetched: all.length,
          totalUnknown: fetched.length === pageSize ? true : false,
        });
        // if we got fewer than pageSize, done
        if (fetched.length < pageSize) break;
        pageOffset += pageSize;
        // safety guard to prevent infinite loop
        if (pageOffset > 1000000) break;
      }

      // Build CSV
      // columns: device_id, ts_iso, ts_local, type, details (JSON string)
      const rows: string[] = [];
      // header
      rows.push(`device_id,ts_iso,ts_local,type,details`);
      for (const r of all) {
        const device_id = csvSafe(String(r.device_id ?? ""));
        const ts_iso = csvSafe(String(r.ts_iso ?? ""));
        const ts_local = csvSafe(
          r.ts_iso
            ? new Date(r.ts_iso).toLocaleString()
            : formatTimestamp(r.ts_raw)
        );
        const type = csvSafe(String(r.type ?? ""));
        const details = csvSafe(
          JSON.stringify(r.details ?? r.rawRow ?? {}, replacerForCsv)
        );
        rows.push(`${device_id},${ts_iso},${ts_local},${type},${details}`);
      }

      const csv = rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const ts = format(new Date(), "yyyyMMdd_HHmmss");
      const meterPart = `${meterId ? meterId.replace(/\s+/g, "_") : "all"}`;
      const fileName = `audio-events-${meterPart}-${ts}.csv`;
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export error", err);
      setLastError(err.message || String(err));
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }

  // safe CSV cell (wrap in quotes if needed, escape quotes)
  function csvSafe(s: string) {
    // remove newlines and normalize spaces
    const oneLine = s.replace(/\r\n|\n|\r/g, " ").trim();
    const escaped = oneLine.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  // replacer for JSON stringify to ensure no functions etc.
  function replacerForCsv(_k: string, v: any) {
    if (typeof v === "object" && v !== null) return v;
    if (v === null || v === undefined) return "";
    return v;
  }

  return (
    <div className="space-y-3 w-full">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Meter / Device ID</Label>
          <Input
            placeholder="enter meter/device id"
            value={meterId}
            onChange={(e) => {
              setMeterId(e.target.value);
              setCurrentPage(1);
            }}
            className="w-56 placeholder:text-gray-400 placeholder:opacity-60"
          />
        </div>

        <div className="flex items-center gap-4">
          <div>
            <Label className="text-xs">Start (UTC)</Label>
            <Input
              type="date"
              value={dateRangeStart}
              onChange={(e) => {
                setDateRangeStart(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">End (UTC)</Label>
            <Input
              type="date"
              value={dateRangeEnd}
              onChange={(e) => {
                setDateRangeEnd(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Rows per page</Label>
          <Select
            value={String(rowsPerPage)}
            onValueChange={(v) => {
              setRowsPerPage(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchData().finally(() => setIsRefreshing(false));
            }}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportCsv();
            }}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>

          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh((s) => !s)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Auto {autoRefresh ? "ON" : "OFF"}
          </Button>
        </div>
      </div>

      {/* Pagination Above Table */}
      <PaginationComponent />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Device ID</TableHead>
              <TableHead className="w-[180px]">Timestamp (UTC)</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[400px]">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-12 text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-12 text-muted-foreground"
                >
                  No events found
                </TableCell>
              </TableRow>
            ) : (
              items.map((ev) => (
                <TableRow
                  key={String(ev.id)}
                  className="hover:bg-muted/30 align-top"
                >
                  <TableCell className="font-medium">
                    {ev.device_id ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {ev.ts_iso
                      ? format(new Date(ev.ts_iso), "yyyy-MM-dd HH:mm:ss")
                      : formatTimestamp(ev.ts_raw)}
                  </TableCell>
                  <TableCell>{ev.type ?? "-"}</TableCell>
                  <TableCell className="align-top">
                    <HoverCard openDelay={200}>
                      <HoverCardTrigger asChild>
                        <div className="cursor-pointer hover:bg-gray-50 transition-colors rounded p-1">
                          <InlineDetails
                            details={ev.details}
                            rawRow={ev.rawRow}
                          />
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent
                        className="w-[500px] max-w-[90vw]"
                        side="top"
                        align="start"
                      >
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">
                            Event Details
                          </h4>
                          <HoverDetails
                            details={ev.details}
                            rawRow={ev.rawRow}
                          />
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Below Table */}
      <PaginationComponent />

      {/* Export progress / status */}
      {exportProgress && (
        <div className="text-sm text-muted-foreground">
          Exported {exportProgress.fetched} rows...
        </div>
      )}

      {lastError && (
        <div className="text-sm text-red-600">Error: {lastError}</div>
      )}
    </div>
  );
}

// components/ui/AudioEventsTable.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { format } from "date-fns";
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
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, Filter, X, CloudDownload, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type AudioEvent = {
  id: string;
  meter_id: string | null;
  fp_file: string | null;
  channel: string | null;
  hit_score: number | null;
  recorder_id: string | null;
  source_type: string | null;
  timestamp_meter: string | number | Date | null;
  timestamp_recorder: string | number | Date | null;
  raw: Record<string, any>;
};

export default function AudioEventsTable() {
  // server pages store (each page: items[] newest-first, nextStart points to older page)
  const [pages, setPages] = useState<
    { items: AudioEvent[]; nextStart: string | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // batch size (how many server pages to load per user action)
  const BATCH_SIZE = 5;

  // auto-refresh toggle
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;

  // dialog filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    meter_id: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });
  const [tempFilters, setTempFilters] = useState(filters);

  // client view pagination
  const viewPageSize = 25;
  const [viewPageIndex, setViewPageIndex] = useState(0);

  // -----------------------
  // Helpers: normalize & parse ts
  // -----------------------
  function normalizeRawItem(it: Record<string, any>): AudioEvent {
    const meterTsCandidates = [
      it.timestamp_meter,
      it.timestamp_meter_iso,
      it.timestamp_meter_epoch,
      it.ts_meter,
      it.meter_ts,
      it.timestamp,
    ];
    const recTsCandidates = [
      it.timestamp_recorder,
      it.timestamp_recorder_iso,
      it.timestamp_recorder_epoch,
      it.ts_recorder,
      it.recorder_ts,
    ];

    const meterTs =
      meterTsCandidates.find((v) => v !== undefined && v !== null) ?? null;
    const idBase =
      it.id ?? it.pk ?? (it.meter_id ? String(it.meter_id) : "item");
    const idSuffix = meterTs
      ? String(meterTs)
      : Math.random().toString(36).slice(2, 9);

    return {
      id: `${idBase}_${idSuffix}`,
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
      timestamp_meter: meterTs,
      timestamp_recorder:
        recTsCandidates.find((v) => v !== undefined && v !== null) ?? null,
      raw: it,
    };
  }

  const parseToDate = (ts?: string | number | Date | null): Date | null => {
    if (ts === undefined || ts === null) return null;
    if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
    if (typeof ts === "number") {
      const ms = ts < 1e11 ? ts * 1000 : ts;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof ts === "string") {
      if (/^\d{8}_\d{6}$/.test(ts)) {
        const [date, time] = ts.split("_");
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
      if (/^-?\d+$/.test(ts)) {
        const n = Number(ts);
        const ms = ts.length <= 10 ? n * 1000 : n;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const safeFormat = (ts?: string | number | Date | null) => {
    const d = parseToDate(ts);
    if (!d) return "-";
    try {
      return format(d, "PPP ppp");
    } catch {
      return d.toISOString();
    }
  };

  // -----------------------
  // Single server page fetch
  // -----------------------
  async function fetchServerPage(startToken?: string | null) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (startToken) params.set("start", startToken);
      const res = await fetch(`/api/audio-events?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fetch failed");
      const items: AudioEvent[] = (json.items || []).map(normalizeRawItem);
      return { items, nextStart: json.nextStart ?? null };
    } finally {
      setIsLoading(false);
    }
  }

  // -----------------------
  // Batch fetch: follow nextStart up to `count` pages (or until no more)
  // returns an array of pages in order received (newest->older)
  // -----------------------
  async function batchFetchPages(
    startToken: string | null | undefined,
    count: number
  ) {
    const collected: { items: AudioEvent[]; nextStart: string | null }[] = [];
    let token = startToken ?? undefined;
    for (let i = 0; i < count; i++) {
      const page = await fetchServerPage(token ?? undefined);
      collected.push(page);
      if (!page.nextStart) break; // no more older pages
      token = page.nextStart;
    }
    return collected;
  }

  // -----------------------
  // Initial load: fetch latest BATCH_SIZE pages
  // -----------------------
  useEffect(() => {
    if (pages.length === 0) {
      (async () => {
        try {
          const fetched = await batchFetchPages(undefined, BATCH_SIZE);
          // dedupe across pages and keep ordering (newest first)
          const seen = new Set<string>();
          const deduped = fetched.map((p) => {
            const items = p.items.filter((it) => {
              if (seen.has(it.id)) return false;
              seen.add(it.id);
              return true;
            });
            return { items, nextStart: p.nextStart };
          });
          setPages(deduped);
        } catch (e) {
          console.error("Initial batch fetch failed", e);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------
  // Load More: fetch next BATCH_SIZE older pages using last page's nextStart
  // -----------------------
  const loadMoreServerPage = async () => {
    const last = pages[pages.length - 1];
    const lastToken = last?.nextStart ?? null;
    if (!lastToken) return;
    setIsLoading(true);
    try {
      const fetched = await batchFetchPages(lastToken, BATCH_SIZE);
      if (!fetched || fetched.length === 0) return;
      // dedupe against existing ids
      const existingIds = new Set(
        pages.flatMap((p) => p.items.map((i) => i.id))
      );
      const deduped = fetched.map((p) => ({
        items: p.items.filter((it) => !existingIds.has(it.id)),
        nextStart: p.nextStart,
      }));
      setPages((cur) => [...cur, ...deduped]);
    } catch (e) {
      console.error("Load more (batch) failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------
  // Fetch All (optional) - uses existing batchFetchPages loop to collect until exhausted
  // -----------------------
  const fetchAllServerPages = async () => {
    if (
      !confirm(
        "Fetch ALL pages from server? This may use a lot of memory and Dynamo reads. Continue?"
      )
    )
      return;
    setIsLoading(true);
    try {
      // start from existing last token if pages exist, else from beginning (newest)
      let all = [...pages];
      // if no pages yet, seed with initial batch
      if (all.length === 0) {
        const firstBatch = await batchFetchPages(undefined, BATCH_SIZE);
        all = firstBatch;
      }
      // keep fetching until no more nextStart
      while (all[all.length - 1]?.nextStart) {
        const token = all[all.length - 1].nextStart!;
        const nextBatch = await batchFetchPages(token, BATCH_SIZE);
        if (!nextBatch || nextBatch.length === 0) break;
        // dedupe as we append
        const existingIds = new Set(
          all.flatMap((p) => p.items.map((i) => i.id))
        );
        const deduped = nextBatch.map((p) => ({
          items: p.items.filter((it) => !existingIds.has(it.id)),
          nextStart: p.nextStart,
        }));
        all = [...all, ...deduped];
        // safety: avoid infinite loops (rare)
        if (all.length > 1000) break;
      }
      setPages(all);
    } catch (e) {
      console.error("Fetch all (batch) failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------
  // Refresh first page and PREPEND new items (dedupe)
  // -----------------------
  const refreshFirstPageAndPrepend = async () => {
    setIsRefreshing(true);
    try {
      const first = await fetchServerPage(); // server returns newest page when no start
      const knownIds = new Set(pages.flatMap((p) => p.items.map((i) => i.id)));
      const newItems = first.items.filter((it) => !knownIds.has(it.id));
      if (newItems.length > 0) {
        setPages((cur) => {
          const existingFirst = cur[0] ?? { items: [], nextStart: null };
          const mergedItems = [
            ...newItems,
            ...existingFirst.items.filter(
              (it) => !newItems.some((n) => n.id === it.id)
            ),
          ];
          const rest = cur.slice(1);
          return [
            {
              items: mergedItems,
              nextStart: existingFirst.nextStart ?? first.nextStart,
            },
            ...rest,
          ];
        });
      } else {
        // replace first page
        setPages((cur) => {
          if (cur.length === 0) return [first];
          const rest = cur.slice(1);
          return [{ items: first.items, nextStart: first.nextStart }, ...rest];
        });
      }
    } catch (e) {
      console.error("Auto-refresh failed", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh polling (30s)
  useEffect(() => {
    if (!autoRefresh) return;
    refreshFirstPageAndPrepend();
    const id = setInterval(() => {
      refreshFirstPageAndPrepend();
    }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  // -----------------------
  // Aggregation & newest-first sort
  // -----------------------
  const allItemsUnsorted = useMemo(
    () => pages.flatMap((p) => p.items),
    [pages]
  );

  const allItems = useMemo(() => {
    const arr = [...allItemsUnsorted];
    arr.sort((a, b) => {
      const da = parseToDate(a.timestamp_meter) ?? new Date(0);
      const db = parseToDate(b.timestamp_meter) ?? new Date(0);
      return db.getTime() - da.getTime();
    });
    return arr;
  }, [allItemsUnsorted]);

  // apply filters locally
  const filteredItems = useMemo(() => {
    return allItems.filter((it) => {
      if (filters.meter_id) {
        if (!it.meter_id) return false;
        if (!it.meter_id.includes(filters.meter_id)) return false;
      }
      let from: Date | null = null;
      let to: Date | null = null;
      if (filters.startDate) {
        const timeStr = filters.startTime || "00:00:00";
        from = new Date(`${filters.startDate}T${timeStr}Z`);
      }
      if (filters.endDate) {
        const timeStr = filters.endTime || "23:59:59";
        to = new Date(`${filters.endDate}T${timeStr}Z`);
      }
      const ts = parseToDate(it.timestamp_meter);
      if (from && (!ts || ts < from)) return false;
      if (to && (!ts || ts > to)) return false;
      return true;
    });
  }, [allItems, filters]);

  // client pagination for filtered view
  const totalViewPages = Math.max(
    1,
    Math.ceil(filteredItems.length / viewPageSize)
  );
  useEffect(() => setViewPageIndex(0), [filters]);
  const viewSlice = filteredItems.slice(
    viewPageIndex * viewPageSize,
    (viewPageIndex + 1) * viewPageSize
  );

  // -----------------------
  // UI render
  // -----------------------
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Filter Audio Events</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Meter ID</Label>
                  <Input
                    value={tempFilters.meter_id}
                    onChange={(e) =>
                      setTempFilters({
                        ...tempFilters,
                        meter_id: e.target.value,
                      })
                    }
                    placeholder="meter-123"
                  />
                </div>
                <div>
                  <Label>Start Date & Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={tempFilters.startDate}
                      onChange={(e) =>
                        setTempFilters({
                          ...tempFilters,
                          startDate: e.target.value,
                        })
                      }
                    />
                    <Input
                      type="time"
                      step="1"
                      value={tempFilters.startTime}
                      onChange={(e) =>
                        setTempFilters({
                          ...tempFilters,
                          startTime: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>End Date & Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={tempFilters.endDate}
                      onChange={(e) =>
                        setTempFilters({
                          ...tempFilters,
                          endDate: e.target.value,
                        })
                      }
                    />
                    <Input
                      type="time"
                      step="1"
                      value={tempFilters.endTime}
                      onChange={(e) =>
                        setTempFilters({
                          ...tempFilters,
                          endTime: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    setTempFilters({
                      meter_id: "",
                      startDate: "",
                      startTime: "",
                      endDate: "",
                      endTime: "",
                    })
                  }
                >
                  Clear
                </Button>
                <Button
                  onClick={() => {
                    setFilters(tempFilters);
                    setFilterOpen(false);
                  }}
                >
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setIsRefreshing(true);
              await refreshFirstPageAndPrepend();
              setIsRefreshing(false);
            }}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")}
            />{" "}
            Refresh
          </Button>

          <Button
            onClick={loadMoreServerPage}
            disabled={
              isLoading ||
              pages.length === 0 ||
              !pages[pages.length - 1]?.nextStart
            }
          >
            Load More
          </Button>

          <Button onClick={fetchAllServerPages} disabled={isLoading}>
            <CloudDownload className="h-4 w-4 mr-1" /> Fetch All
          </Button>

          <Button
            onClick={() => setAutoRefresh((s) => !s)}
            variant={autoRefresh ? "default" : "outline"}
          >
            <Play className="h-4 w-4 mr-1" /> Auto {autoRefresh ? "ON" : "OFF"}
          </Button>
        </div>
      </div>

      {/* Active filters */}
      {(filters.meter_id || filters.startDate || filters.endDate) && (
        <div className="flex items-center gap-2 flex-wrap bg-blue-50 p-3 rounded-md border border-blue-200">
          <span className="text-sm font-medium text-blue-900">
            Active Filters:
          </span>
          {filters.meter_id && (
            <span className="px-2 py-1 bg-white rounded text-sm border">
              Meter: <strong>{filters.meter_id}</strong>
            </span>
          )}
          {filters.startDate && (
            <span className="px-2 py-1 bg-white rounded text-sm border">
              From:{" "}
              <strong>
                {filters.startDate} {filters.startTime || "00:00:00"}
              </strong>
            </span>
          )}
          {filters.endDate && (
            <span className="px-2 py-1 bg-white rounded text-sm border">
              To:{" "}
              <strong>
                {filters.endDate} {filters.endTime || "23:59:59"}
              </strong>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({
                meter_id: "",
                startDate: "",
                startTime: "",
                endDate: "",
                endTime: "",
              });
              setTempFilters({
                meter_id: "",
                startDate: "",
                startTime: "",
                endDate: "",
                endTime: "",
              });
            }}
            className="ml-auto"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Meter ID</TableHead>
              <TableHead className="w-48">Timestamp (Meter)</TableHead>
              <TableHead className="w-48">Timestamp (Recorder)</TableHead>
              <TableHead>Recorder ID</TableHead>
              <TableHead className="w-32">Channel</TableHead>
              <TableHead className="w-32">Hit Score</TableHead>
              <TableHead>Source Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {viewSlice.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No events match the filters / no data loaded.
                </TableCell>
              </TableRow>
            ) : (
              viewSlice.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">
                    {ev.meter_id ?? "-"}
                  </TableCell>
                  <TableCell>{safeFormat(ev.timestamp_meter)}</TableCell>
                  <TableCell>{safeFormat(ev.timestamp_recorder)}</TableCell>
                  <TableCell>{ev.recorder_id ?? "-"}</TableCell>
                  <TableCell>{ev.channel ?? "-"}</TableCell>
                  <TableCell>
                    {ev.hit_score !== null && ev.hit_score !== undefined
                      ? ev.hit_score.toFixed(4)
                      : "-"}
                  </TableCell>
                  <TableCell>{ev.source_type ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* client pagination for filtered view */}
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm text-gray-600">
          {filteredItems.length === 0
            ? "0 results"
            : `Showing ${filteredItems.length} results — page ${
                viewPageIndex + 1
              }/${totalViewPages}`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setViewPageIndex(Math.max(0, viewPageIndex - 1))}
            disabled={viewPageIndex === 0}
          >
            Prev
          </Button>
          <Button
            onClick={() =>
              setViewPageIndex(Math.min(totalViewPages - 1, viewPageIndex + 1))
            }
            disabled={viewPageIndex >= totalViewPages - 1}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mt-1">
        <div>Server pages loaded: {pages.length}</div>
        <div>
          Server more pages:{" "}
          {pages.length
            ? pages[pages.length - 1]?.nextStart
              ? "yes"
              : "no"
            : "unknown"}
        </div>
      </div>
    </div>
  );
}

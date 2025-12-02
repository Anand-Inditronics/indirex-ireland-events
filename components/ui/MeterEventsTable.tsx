"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { MeterEvent } from "@/lib/meterEvents";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandEmpty,
} from "@/components/ui/command";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Filter, Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const DETECTION_TYPES = [
  "OCR",
  "faces",
  "tv_channel",
  "object_detection",
  "content_detection",
] as const;

type DetectionType = (typeof DETECTION_TYPES)[number];

interface EventFilters {
  deviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  detectionTypes: DetectionType[];
}

interface MeterEventsTableProps {
  data: MeterEvent[];
  initialFilters: {
    deviceId: string;
    date: string;
    startTime: string;
    endTime: string;
    detectionTypes: string[];
  };
}

function epochToDateTime(ts: number): string {
  const ms = ts < 1_000_000_000_000 ? ts * 1000 : ts;
  const d = new Date(ms);

  const pad = (n: number) => n.toString().padStart(2, "0");

  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function renderAllDetectionItems(arr: any[]): React.ReactNode {
  if (!arr || !arr.length)
    return <div className="text-xs text-gray-500">No data</div>;

  return (
    <div className="space-y-2 text-xs max-h-[400px] overflow-y-auto">
      {arr.map((item, idx) => {
        if (
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean"
        ) {
          return (
            <div key={idx} className="p-2 bg-gray-50 rounded border">
              {String(item)}
            </div>
          );
        }

        if (Array.isArray(item)) {
          return (
            <div key={idx} className="p-2 bg-gray-50 rounded border">
              {JSON.stringify(item, null, 2)}
            </div>
          );
        }

        if (item && typeof item === "object") {
          const entries = Object.entries(item);
          return (
            <div key={idx} className="p-2 bg-gray-50 rounded border space-y-1">
              {entries.map(([key, value]) => {
                let displayValue: string;

                if (Array.isArray(value)) {
                  displayValue = JSON.stringify(value);
                } else if (value && typeof value === "object") {
                  displayValue = JSON.stringify(value);
                } else {
                  displayValue = String(value);
                }

                return (
                  <div key={key}>
                    <span className="font-semibold text-gray-700">{key}:</span>{" "}
                    <span className="text-gray-600">{displayValue}</span>
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <div key={idx} className="p-2 bg-gray-50 rounded border">
            {JSON.stringify(item)}
          </div>
        );
      })}
    </div>
  );
}

function renderDetectionItems(arr: any[]): React.ReactNode {
  if (!arr || !arr.length) return null;

  const itemsToShow = arr.slice(0, 3);

  return (
    <div className="space-y-1 text-xs">
      {itemsToShow.map((item, idx) => {
        if (
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean"
        ) {
          return (
            <div key={idx} className="truncate">
              {String(item)}
            </div>
          );
        }

        if (Array.isArray(item)) {
          return (
            <div key={idx} className="truncate">
              {JSON.stringify(item)}
            </div>
          );
        }

        if (item && typeof item === "object") {
          const entries = Object.entries(item).slice(0, 4);
          return (
            <div key={idx} className="space-y-0.5">
              {entries.map(([key, value]) => {
                let displayValue: string;

                if (Array.isArray(value)) {
                  displayValue = JSON.stringify(value);
                } else if (value && typeof value === "object") {
                  displayValue = JSON.stringify(value);
                } else {
                  displayValue = String(value);
                }

                return (
                  <div key={key} className="truncate">
                    <span className="font-medium">{key}:</span>{" "}
                    <span>{displayValue}</span>
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <div key={idx} className="truncate">
            {JSON.stringify(item)}
          </div>
        );
      })}

      {arr.length > itemsToShow.length && (
        <div className="text-[10px] text-gray-500">
          +{arr.length - itemsToShow.length} more…
        </div>
      )}
    </div>
  );
}

function DetectionCell({ data, title }: { data: any[]; title: string }) {
  if (!data || !data.length) return null;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer hover:bg-gray-50 transition-colors rounded p-1">
          {renderDetectionItems(data)}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-[500px] max-w-[90vw]"
        side="top"
        align="start"
      >
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          {renderAllDetectionItems(data)}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function MeterEventsTable({
  data,
  initialFilters,
}: MeterEventsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedTypes, setSelectedTypes] = useState<DetectionType[]>(
    initialFilters.detectionTypes as DetectionType[]
  );
  const [tempFilters, setTempFilters] = useState<EventFilters>({
    deviceId: initialFilters.deviceId,
    date: initialFilters.date,
    startTime: initialFilters.startTime,
    endTime: initialFilters.endTime,
    detectionTypes: initialFilters.detectionTypes as DetectionType[],
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  const hasActiveFilters =
    initialFilters.deviceId ||
    initialFilters.date ||
    initialFilters.startTime ||
    initialFilters.endTime;

  const updateURL = (filters: EventFilters) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset to page 1 when filters change
    params.set("page", "1");

    if (filters.deviceId) {
      params.set("deviceId", filters.deviceId);
    } else {
      params.delete("deviceId");
    }

    if (filters.date) {
      params.set("date", filters.date);
    } else {
      params.delete("date");
    }

    if (filters.startTime) {
      params.set("startTime", filters.startTime);
    } else {
      params.delete("startTime");
    }

    if (filters.endTime) {
      params.set("endTime", filters.endTime);
    } else {
      params.delete("endTime");
    }

    if (filters.detectionTypes.length > 0) {
      params.set("detectionTypes", filters.detectionTypes.join(","));
    } else {
      params.delete("detectionTypes");
    }

    router.push(`?${params.toString()}`);
  };

  const applyFilters = () => {
    updateURL(tempFilters);
    setFilterDialogOpen(false);
  };

  const clearFilters = () => {
    const empty: EventFilters = {
      deviceId: "",
      date: "",
      startTime: "",
      endTime: "",
      detectionTypes: [],
    };
    setTempFilters(empty);
    setSelectedTypes([]);
    updateURL(empty);
  };

  const handleDetectionTypeChange = (types: DetectionType[]) => {
    setSelectedTypes(types);
    const newFilters = { ...tempFilters, detectionTypes: types };
    updateURL(newFilters);
  };

  if (!data.length) {
    return <div className="text-sm text-gray-500">No events found.</div>;
  }

  return (
    <div className="space-y-3 w-full">
      {/* FILTER BAR */}
      <div className="flex items-center gap-3 flex-wrap">
        <DetectionTypeFilter
          selectedTypes={selectedTypes}
          onChange={handleDetectionTypeChange}
        />

        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Filter className="h-4 w-4" />
              Filter Events
              {hasActiveFilters && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                  •
                </span>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Filter Events</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Device ID Filter */}
              <div className="space-y-2">
                <Label htmlFor="deviceId">Device ID</Label>
                <Input
                  id="deviceId"
                  placeholder="Enter device ID..."
                  value={tempFilters.deviceId}
                  onChange={(e) =>
                    setTempFilters({ ...tempFilters, deviceId: e.target.value })
                  }
                />
              </div>

              {/* Date Picker */}
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempFilters.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempFilters.date ? (
                        format(new Date(tempFilters.date), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        tempFilters.date
                          ? new Date(tempFilters.date)
                          : undefined
                      }
                      onSelect={(date: any) =>
                        setTempFilters({
                          ...tempFilters,
                          date: date ? format(date, "yyyy-MM-dd") : "",
                        })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={tempFilters.startTime}
                    onChange={(e) =>
                      setTempFilters({
                        ...tempFilters,
                        startTime: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
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
              <Button variant="outline" onClick={clearFilters}>
                Clear All
              </Button>
              <Button onClick={applyFilters}>Apply Filters</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {selectedTypes.length > 0 && (
          <span className="text-xs text-gray-600">
            Detection types: {selectedTypes.join(", ")}
          </span>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2"
          >
            <X className="h-4 w-4 mr-1" />
            Clear event filters
          </Button>
        )}
      </div>

      {/* Results count - now shows actual filtered count from server */}
      <div className="text-sm text-gray-600">Showing {data.length} events</div>

      {/* FULL-WIDTH TABLE */}
      <Table className="w-full">
        <TableHeader>
          <TableRow className="text-sm">
            <TableHead className="w-[120px]">Device ID</TableHead>
            <TableHead className="w-[160px]">Timestamp</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[180px]">OCR</TableHead>
            <TableHead className="w-[180px]">Faces</TableHead>
            <TableHead className="w-[180px]">TV Channel</TableHead>
            <TableHead className="w-[200px]">Object Detection</TableHead>
            <TableHead className="w-[220px]">Content Detection</TableHead>
            <TableHead className="w-[240px]">Image</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((event, idx) => (
            <TableRow key={idx} className="text-sm align-top">
              <TableCell className="pr-4">{event.deviceId}</TableCell>
              <TableCell className="pr-4 whitespace-nowrap">
                {epochToDateTime(event.timestamp)}
              </TableCell>
              <TableCell className="pr-4">{event.status}</TableCell>

              {/* Detection Columns with Hover Cards */}
              <TableCell className="pr-4 align-top">
                <DetectionCell
                  data={event.detections.OCR}
                  title="OCR Detection"
                />
              </TableCell>
              <TableCell className="pr-4 align-top">
                <DetectionCell
                  data={event.detections.faces}
                  title="Face Detection"
                />
              </TableCell>
              <TableCell className="pr-4 align-top">
                <DetectionCell
                  data={event.detections.tv_channel}
                  title="TV Channel Detection"
                />
              </TableCell>
              <TableCell className="pr-4 align-top">
                <DetectionCell
                  data={event.detections.object_detection}
                  title="Object Detection"
                />
              </TableCell>
              <TableCell className="pr-4 align-top">
                <DetectionCell
                  data={event.detections.content_detection}
                  title="Content Detection"
                />
              </TableCell>

              {/* IMAGE COLUMN */}
              <TableCell className="pr-4">
                {event.processedS3Key ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="border rounded overflow-hidden h-26 w-26">
                        <img
                          src={event.processedS3Key}
                          alt="processed"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Processed Image</DialogTitle>
                      </DialogHeader>
                      <div className="w-full flex justify-center">
                        <img
                          src={event.processedS3Key}
                          alt="processed-full"
                          className="max-h-[80vh] w-auto object-contain rounded border"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <span className="text-xs text-gray-400">No image</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ------------------------ FILTER COMPONENT ------------------------ */

function DetectionTypeFilter({
  selectedTypes,
  onChange,
}: {
  selectedTypes: DetectionType[];
  onChange: (types: DetectionType[]) => void;
}) {
  const toggle = (type: DetectionType) => {
    if (selectedTypes.includes(type))
      onChange(selectedTypes.filter((t) => t !== type));
    else onChange([...selectedTypes, type]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1">
          Filter detections
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search detection types..." />
          <CommandList>
            <CommandEmpty>No detection types found.</CommandEmpty>
            <CommandGroup>
              {DETECTION_TYPES.map((type) => (
                <CommandItem
                  key={type}
                  onSelect={() => toggle(type)}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => toggle(type)}
                  />
                  <span>{type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

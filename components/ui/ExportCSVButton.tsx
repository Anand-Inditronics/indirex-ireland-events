// components/ui/ExportCSVButton.tsx
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Calendar as CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DETECTION_TYPES = [
  "OCR",
  "faces",
  "tv_channel",
  "object_detection",
  "content_detection",
] as const;
type DetectionType = (typeof DETECTION_TYPES)[number];

interface ExportFilters {
  deviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  detectionTypes: DetectionType[];
}

export default function ExportCSVButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<ExportFilters>({
    deviceId: "",
    date: "",
    startTime: "",
    endTime: "",
    detectionTypes: [],
  });

  const buildExportURL = () => {
    const params = new URLSearchParams();

    if (filters.deviceId) params.set("deviceId", filters.deviceId);
    if (filters.date) params.set("date", filters.date);
    if (filters.startTime) params.set("startTime", filters.startTime);
    if (filters.endTime) params.set("endTime", filters.endTime);
    if (filters.detectionTypes.length > 0)
      params.set("detectionTypes", filters.detectionTypes.join(","));

    return `/api/events/export-csv?${params.toString()}`;
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const url = buildExportURL();
      const res = await fetch(url);

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `meter-events-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();

      setOpen(false);
    } catch (err) {
      alert("Failed to export CSV. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      deviceId: "",
      date: "",
      startTime: "",
      endTime: "",
      detectionTypes: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Export Events to CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Device ID */}
          <div className="space-y-2">
            <Label htmlFor="export-deviceId">Device ID</Label>
            <Input
              id="export-deviceId"
              placeholder="Enter device ID..."
              value={filters.deviceId}
              onChange={(e) =>
                setFilters({ ...filters, deviceId: e.target.value })
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
                    !filters.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.date
                    ? format(new Date(filters.date), "PPP")
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.date ? new Date(filters.date) : undefined}
                  onSelect={(d) =>
                    setFilters({
                      ...filters,
                      date: d ? format(d, "yyyy-MM-dd") : "",
                    })
                  }
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="export-startTime">Start Time</Label>
              <Input
                id="export-startTime"
                type="time"
                value={filters.startTime}
                onChange={(e) =>
                  setFilters({ ...filters, startTime: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-endTime">End Time</Label>
              <Input
                id="export-endTime"
                type="time"
                value={filters.endTime}
                onChange={(e) =>
                  setFilters({ ...filters, endTime: e.target.value })
                }
              />
            </div>
          </div>

          {/* Detection Types */}
          <div className="space-y-2">
            <Label>Detection Types (any match)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {filters.detectionTypes.length === 0
                    ? "Select detection types..."
                    : filters.detectionTypes.join(", ")}
                  <Filter className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search..." />
                  <CommandList>
                    <CommandEmpty>No types found.</CommandEmpty>
                    <CommandGroup>
                      {DETECTION_TYPES.map((type) => (
                        <CommandItem
                          key={type}
                          onSelect={() => {
                            setFilters({
                              ...filters,
                              detectionTypes: filters.detectionTypes.includes(
                                type
                              )
                                ? filters.detectionTypes.filter(
                                    (t) => t !== type
                                  )
                                : [...filters.detectionTypes, type],
                            });
                          }}
                        >
                          <Checkbox
                            checked={filters.detectionTypes.includes(type)}
                            className="mr-2"
                          />
                          {type}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={clearFilters}>
            Clear
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? "Generating..." : "Download CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

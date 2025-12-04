// app/audio-events/page.tsx
import React from "react";
import AudioEventsTable from "@/components/ui/AudioEventsTable";

export default function AudioEventsPage() {
  return (
    <main className="p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Audio Events</h1>
        <AudioEventsTable />
      </div>
    </main>
  );
}

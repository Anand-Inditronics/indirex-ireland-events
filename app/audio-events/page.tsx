// app/audio-events/page.tsx
import React from "react";
import AudioEventsTable from "@/components/ui/AudioEventsTable";

export const metadata = {
  title: "Audio Events",
};

export default function AudioEventsPage() {
  return (
    <main className="p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">
            Audio Events (meter_audio_events)
          </h1>
          <p className="text-sm text-muted-foreground">
            Shows device id, timestamp, type and details. Data comes from
            /api/audio-events (Postgres).
          </p>
        </header>

        <section>
          <AudioEventsTable />
        </section>
      </div>
    </main>
  );
}

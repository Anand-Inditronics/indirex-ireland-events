// app/page.tsx
export default function LandingPage() {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Indirex Ireland</h1>
      <p className="text-sm text-gray-600">
        Welcome. Use the navigation bar to sign in and view processed meter
        image events from your devices.
      </p>
      <p className="text-sm text-gray-600">
        After signing in, go to the <strong>Events</strong> page to see the
        latest detections and images.
      </p>
    </div>
  );
}

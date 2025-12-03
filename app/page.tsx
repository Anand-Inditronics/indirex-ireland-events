// app/page.tsx
import { redirect } from "next/navigation";

export default function LandingPage() {
  // This runs on the server (or at build time for static pages)
  redirect("/signin");
}

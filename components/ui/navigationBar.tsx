// navigationBar.tsx (updated)
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetHeader,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { UserNavSection } from "@/components/ui/user-nav-section";

export default function NavBar() {
  return (
    <header className="w-full border-b bg-background">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-semibold text-lg">
          Indirex Ireland
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/events" className="text-sm hover:text-foreground">
            Events
          </Link>
          <UserNavSection />
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-5">
                <Link href="/" className="text-sm font-medium">
                  Home
                </Link>
                <Link href="/events" className="text-sm">
                  Events
                </Link>
                <div className="border-t pt-5">
                  <UserNavSection className="gap-2" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

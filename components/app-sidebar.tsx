// components/app-sidebar.tsx
"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { AudioLines } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { UserNavSection } from "@/components/ui/user-nav-section";
import rex from "../../public/rex.svg";

export function AppSidebar() {
  // Removed useSession() completely — not needed!
  // Your UserNavSection already knows if user is logged in

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" className="flex items-center gap-3">
                <img src="/rex.svg" alt="Rex" className="h-full w-full" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="bg-gray-200">
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/events">
                <Menu className="h-4 w-4" />
                <span>Events</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu className="bg-gray-200">
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/audio-events">
                <AudioLines className="h-4 w-4" />
                <span>Audio Events</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      

      <SidebarFooter>
        <div className="p-3">
          <UserNavSection className="flex-col gap-3" />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

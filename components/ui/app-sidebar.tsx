"use client";

import { useSession } from "next-auth/react";
import Cookies from "js-cookie";
import { NavMain } from "@/components/ui/nav-main";
import { NavUser } from "@/components/ui/nav-user";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  SquareTerminal,
  List,
  Bot,
  Users,
  Cpu,
  PieChart,
  Home,
  Calendar,
  LogIn,
  UserPlus,
} from "lucide-react";

export function AppSidebar({ ...props }) {
  const { data: session, status } = useSession();
  const userRole = Cookies.get("auth_user_role");
  const isAdmin = userRole === "ADMIN";

  const publicItems = [
    { title: "Home", url: "/", icon: Home },
    { title: "Events", url: "/events", icon: Calendar },
  ];

  const protectedItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: SquareTerminal,
      adminOnly: true,
    },
    { title: "Live Stream", url: "/live-stream", icon: List, adminOnly: true },
    { title: "Annotations", url: "/annotations/labeling", icon: Bot },
    {
      title: "User Management",
      url: "/user-management",
      icon: Users,
      adminOnly: true,
    },
    {
      title: "Device Management",
      url: "/device-management",
      icon: Cpu,
      adminOnly: true,
    },
    { title: "Reports", url: "/reports", icon: PieChart, adminOnly: true },
  ];

  const navItems = session
    ? protectedItems.map((item) => ({
        ...item,
        disabled: item.adminOnly && !isAdmin,
        url: item.adminOnly && !isAdmin ? "#" : item.url,
      }))
    : publicItems;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={session ? "/dashboard" : "/"}>
                <img src="/rex.svg" alt="Rex" className="h-8 w-auto" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>

      <SidebarFooter>
        {status === "loading" ? null : session ? (
          <NavUser />
        ) : (
          <PublicAuthFooter />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function PublicAuthFooter() {
  return (
    <div className="flex flex-col gap-2 p-2">
      <SidebarMenuButton asChild>
        <a href="/signin">
          <LogIn className="h-4 w-4" />
          <span>Sign In</span>
        </a>
      </SidebarMenuButton>
      <SidebarMenuButton asChild>
        <a href="/register">
          <UserPlus className="h-4 w-4" />
          <span>Register</span>
        </a>
      </SidebarMenuButton>
    </div>
  );
}

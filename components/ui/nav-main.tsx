// components/nav-main.tsx
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ChevronRight } from "lucide-react";
import { type LucideIcon } from "lucide-react";

type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  disabled?: boolean;
  items?: { title: string; url: string }[];
};

type NavMainProps = {
  items: NavItem[];
};

export function NavMain({ items }: NavMainProps) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={
              typeof window !== "undefined" &&
              window.location.pathname === item.url
            }
            className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
            tooltip={item.title}
            disabled={item.disabled}
          >
            <a
              href={item.disabled ? "#" : item.url}
              className={item.disabled ? "pointer-events-none opacity-50" : ""}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.title}</span>
              {item.items && item.items.length > 0 && (
                <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/menu-item:rotate-90" />
              )}
            </a>
          </SidebarMenuButton>

          {/* Submenu (for Annotations → Labeling / Labeled Data) */}
          {item.items && item.items.length > 0 && (
            <SidebarMenu className="pl-8">
              {item.items.map((subItem) => (
                <SidebarMenuItem key={subItem.title}>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={
                      typeof window !== "undefined" &&
                      window.location.pathname === subItem.url
                    }
                  >
                    <a href={subItem.url}>{subItem.title}</a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

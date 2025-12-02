// components/nav-user.tsx (example)
import { UserNavSection } from "./user-nav-section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";

export function NavUser() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center gap-3 p-2">
      <Avatar>
        <AvatarFallback>
          {session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? "U"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="text-sm font-medium">
          {session?.user?.name ?? session?.user?.email}
        </p>
        <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
      </div>
      <UserNavSection /> {/* Reuses exact same sign-out button */}
    </div>
  );
}

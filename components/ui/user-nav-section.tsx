// components/user-nav-section.tsx
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut } from "lucide-react";

export function UserNavSection({ className = "" }: { className?: string }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-muted-foreground">Loading...</span>;
  }

  if (session?.user) {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Hi,</span>
          <span className="font-medium">
            {session.user.name ?? session.user.email}
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="justify-start"
          onClick={() => signOut({ callbackUrl: "/signin" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <Link href="/signin">
        <Button size="sm" className="w-full justify-center">
          Sign in
        </Button>
      </Link>
      <Link href="/register">
        <Button size="sm" className="w-full">
          Register
        </Button>
      </Link>
    </div>
  );
}

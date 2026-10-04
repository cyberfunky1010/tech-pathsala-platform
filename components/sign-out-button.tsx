"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export default function SignOutButton({ className = "nav-item" }: { className?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) return;
    router.replace("/login");
    router.refresh();
  }

  return <button type="button" className={className} onClick={() => void signOut()}><LogOut size={18} /><span>Sign out</span></button>;
}

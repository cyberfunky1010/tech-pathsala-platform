"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getApiData } from "@/lib/api/client";
import SignOutButton from "@/components/sign-out-button";

type Account = {
  email: string | null;
  username: string | null;
  accountType: string;
  roles: string[];
  workspace: { mode: string; schoolId?: string };
  workspaces: Array<{ mode: string; schoolId?: string; label: string }>;
};

export default function AccountBadge() {
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getApiData<{ data: Account }>("/api/v1/auth/me")
        .then((response) => setAccount(response.data))
        .catch(() => setAccount(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!account) return null;
  const currentAccount = account;

  async function switchWorkspace(value: string) {
    const selected = currentAccount.workspaces.find((item) => `${item.mode}:${item.schoolId ?? ""}` === value);
    if (!selected) return;
    const response = await fetch("/api/v1/auth/workspace", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: selected.mode, schoolId: selected.schoolId }),
    });
    if (response.ok) {
      window.location.assign(selected.mode === "CENTRAL_ADMIN" ? "/central-admin" : "/school-admin");
    }
  }

  const currentValue = `${currentAccount.workspace.mode}:${currentAccount.workspace.schoolId ?? ""}`;
  return (
    <div className="account-context" title={`Signed in as ${currentAccount.email ?? currentAccount.username ?? "user"}`}>
      <ShieldCheck size={14} />
      <select className="account-workspace-select" value={currentValue} onChange={(event) => void switchWorkspace(event.target.value)} aria-label="Active workspace">
        {currentAccount.workspaces.map((workspace) => <option key={`${workspace.mode}:${workspace.schoolId ?? ""}`} value={`${workspace.mode}:${workspace.schoolId ?? ""}`}>{workspace.label}</option>)}
      </select>
      <SignOutButton className="account-sign-out" />
    </div>
  );
}

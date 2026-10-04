"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, MailPlus, ShieldCheck, Sparkles, UserMinus, ArrowRightLeft } from "lucide-react";
import { getApiData } from "@/lib/api/client";
import AccountBadge from "@/components/account-badge";

type School = { id: string; name: string; schoolCode: string };
type Assignment = { id: string; status: string; startedAt: string; endedAt: string | null; school: School };
type Admin = { id: string; email: string | null; status: string; roles: string[]; assignments: Assignment[] };

export default function CentralAdminManagement() {
  const [schools, setSchools] = useState<School[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"CENTRAL_ADMIN" | "SCHOOL_ADMIN">("SCHOOL_ADMIN");
  const [schoolId, setSchoolId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCentralWorkspace, setIsCentralWorkspace] = useState(false);

  async function load() {
    try {
      const account = await getApiData<{ data: { workspace: { mode: string } } }>("/api/v1/auth/me");
      const centralWorkspace = account.data.workspace.mode === "CENTRAL_ADMIN";
      setIsCentralWorkspace(centralWorkspace);
      if (!centralWorkspace) {
        setError("Switch to Central Admin workspace to manage administrators.");
        return;
      }
      const response = await getApiData<{ data: { schools: School[]; admins: Admin[] } }>("/api/v1/admin/admins");
      setSchools(response.data.schools);
      setAdmins(response.data.admins);
      if (response.data.schools[0]) setSchoolId((current) => current || response.data.schools[0].id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admin management could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/admins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, schoolId }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Invitation could not be sent.");
      setEmail("");
      setMessage(`Invitation sent to ${email}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invitation could not be sent.");
    } finally {
      setSaving(false);
    }

  }

  async function updateAssignment(admin: Admin, assignment: Assignment, action: "END" | "REASSIGN") {
    const replacement = action === "REASSIGN" ? window.prompt("Enter the replacement school ID:\n\n" + schools.map((school) => `${school.name} (${school.id})`).join("\n")) : undefined;
    if (action === "REASSIGN" && !replacement) return;
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/admins?adminId=${admin.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, assignmentId: assignment.id, ...(replacement ? { schoolId: replacement } : {}) }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Assignment could not be updated.");
      setMessage(action === "END" ? "Assignment ended." : "Assignment reassigned.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Assignment could not be updated.");
    }
  }

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div><div className="profile-mini"><div className="avatar avatar-amber">CA</div><div><strong>Central Admin</strong><span>Platform management</span></div></div><nav className="main-nav"><p className="nav-label">Platform</p><a className="nav-item active" href="/central-admin"><ShieldCheck size={18} /><span>Administrators</span></a><a className="nav-item" href="/school-admin"><span>School workspace</span></a></nav></aside><section className="content-area"><header className="topbar"><div className="breadcrumb"><span>Platform</span><span>/</span><strong>Administrators</strong></div><div className="topbar-actions"><AccountBadge /></div></header><div className="page-content"><section className="welcome-row"><div><p className="eyebrow">Central Admin</p><h1>Administrators</h1><p className="welcome-copy">Invite administrators and assign their managed school.</p></div></section>{error && <div className="learn-state learn-state-error"><p>{error}</p></div>}{message && <div className="learn-state"><p>{message}</p></div>}<section className="dashboard-grid">{isCentralWorkspace && <form className="section-card" onSubmit={invite}><div className="card-heading"><div><p className="card-kicker">Invite</p><h2>Add administrator</h2></div><MailPlus size={20} /></div><label className="admin-field">Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@school.com" /></label><label className="admin-field">Role<select value={role} onChange={(event) => setRole(event.target.value as "CENTRAL_ADMIN" | "SCHOOL_ADMIN")}><option value="SCHOOL_ADMIN">School Admin</option><option value="CENTRAL_ADMIN">Central Admin + School Admin</option></select></label><label className="admin-field">Managed school<select required value={schoolId} onChange={(event) => setSchoolId(event.target.value)}><option value="" disabled>Select school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name} ({school.schoolCode})</option>)}</select></label><button className="primary-button" disabled={saving || !schoolId}>{saving ? <LoaderCircle size={17} className="spin" /> : <MailPlus size={17} />} {saving ? "Sending…" : "Send invitation"}</button></form>}<section className="section-card"><div className="card-heading"><div><p className="card-kicker">Current access</p><h2>Administrators</h2></div><ShieldCheck size={20} /></div>{loading ? <div className="learn-state"><LoaderCircle size={22} className="spin" /><p>Loading administrators…</p></div> : admins.length === 0 ? <div className="empty-learn"><ShieldCheck size={24} /><h3>No administrators yet</h3><p>Invite the first administrator.</p></div> :   <div className="admin-material-list">{admins.map((admin) => <article className="admin-material-item" key={admin.id}><div><span className="item-type">{admin.roles.join(" · ")}</span><strong>{admin.email ?? "No email"}</strong>{admin.assignments.length === 0 ? <span>{admin.status} · No active school assignment</span> : admin.assignments.map((assignment) => <div key={assignment.id} className="admin-assignment-row">  <span>{assignment.endedAt ? `Historical · ${assignment.school.name} (${assignment.school.schoolCode})` : `${admin.status} · ${assignment.school.name} (${assignment.school.schoolCode})`}</span>{!assignment.endedAt && <span className="admin-assignment-actions"><button type="button" className="text-button" onClick={() => void updateAssignment(admin, assignment, "REASSIGN")}><ArrowRightLeft size={14} /> Reassign</button><button type="button" className="text-button" onClick={() => void updateAssignment(admin, assignment, "END")}><UserMinus size={14} /> End</button></span>}</div>)}</div></article>)}</div>}</section></section></div></section></main>;
}

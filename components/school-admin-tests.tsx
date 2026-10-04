"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, ClipboardCheck, FileQuestion, LoaderCircle, Plus, Sparkles, Trash2, Users } from "lucide-react";
import Link from "next/link";
import AccountBadge from "@/components/account-badge";
import { getApiData } from "@/lib/api/client";

type Subject = { id: string; name: string; code: string };
type Test = { id: string; title: string; subjectName: string; classLevel: number; scope: string; schoolName: string | null; durationSeconds: number; startsAt: string; endsAt: string; status: string; questionCount: number | null; createdQuestionCount: number };
type WorkspaceResponse = { data: { workspace: { mode: string; schoolId?: string }; workspaces: Array<{ mode: string; schoolId?: string; label: string }> } };

export default function SchoolAdminTests() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceResponse["data"] | null>(null);
  const [form, setForm] = useState({ title: "", description: "", subjectId: "", classLevel: "9", scope: "SCHOOL", schoolId: "", duration: "60", startsAt: "", endsAt: "", status: "DRAFT", questionCount: "", randomizeQuestions: true, randomizeOptions: true });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState(""); const [subjectCode, setSubjectCode] = useState(""); const [subjectSaving, setSubjectSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [subjectsResponse, testsResponse, workspaceResponse] = await Promise.all([
        getApiData<{ data: Subject[] }>("/api/v1/subjects"),
        getApiData<{ data: Test[] }>("/api/v1/tests"),
        getApiData<WorkspaceResponse>("/api/v1/auth/me"),
      ]);
      setSubjects(subjectsResponse.data); setTests(testsResponse.data); setWorkspace(workspaceResponse.data);
      if (subjectsResponse.data[0]) setForm((current) => ({ ...current, subjectId: current.subjectId || subjectsResponse.data[0].id }));
      const activeSchool = workspaceResponse.data.workspace.schoolId;
      if (activeSchool) setForm((current) => ({ ...current, schoolId: current.schoolId || activeSchool }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tests could not be loaded."); } finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    try {
      const startsAt = new Date(form.startsAt);
      const endsAt = new Date(form.endsAt);
      const schoolId = form.schoolId || workspace?.workspace.schoolId;
      if (!form.subjectId) throw new Error("No published subjects are available. Create or publish a subject first.");
      if (!form.startsAt || Number.isNaN(startsAt.getTime())) throw new Error("Choose a valid start date and time.");
      if (!form.endsAt || Number.isNaN(endsAt.getTime())) throw new Error("Choose a valid end date and time.");
      if (endsAt <= startsAt) throw new Error("End time must be after start time.");
      if (form.scope === "SCHOOL" && !schoolId) throw new Error("No school is assigned to the active workspace.");
      const response = await fetch("/api/v1/tests", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: form.title, description: form.description || undefined, subjectId: form.subjectId, classLevel: Number(form.classLevel),
        scope: form.scope, ...(form.scope === "SCHOOL" && schoolId ? { schoolId } : {}),
        durationSeconds: Number(form.duration) * 60, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
        status: form.status, randomizeQuestions: form.randomizeQuestions, randomizeOptions: form.randomizeOptions,
        questionCount: form.questionCount ? Number(form.questionCount) : undefined,
      }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Test could not be created.");
      setForm((current) => ({ ...current, title: "", description: "", startsAt: "", endsAt: "", questionCount: "" }));
      setMessage("Test created successfully."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Test could not be created."); } finally { setSaving(false); }
  }
  async function createSubject() {
    setSubjectSaving(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/subjects", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: subjectName, code: subjectCode }) });
      const payload = await response.json() as { data?: Subject; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Subject could not be created.");
      setSubjectName(""); setSubjectCode(""); setMessage("Subject created and published successfully."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Subject could not be created."); } finally { setSubjectSaving(false); }
  }
  async function deleteTest(test: Test) {
    if (!window.confirm(`Delete "${test.title}"? This will also delete its questions and cannot be undone.`)) return;
    setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tests/${test.id}`, { method: "DELETE", credentials: "include" });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "The test could not be deleted.");
      setMessage("Test deleted successfully."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The test could not be deleted."); }
  }
  async function updateStatus(test: Test, status: string) {
    setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tests/${test.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "The test could not be updated.");
      setMessage(`"${test.title}" is now ${status.toLowerCase()}.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The test could not be updated."); }
  }
  const central = workspace?.workspace.mode === "CENTRAL_ADMIN";
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div><div className="profile-mini"><div className="avatar avatar-amber">SA</div><div><strong>School Admin</strong><span>Content workspace</span></div></div><nav className="main-nav" aria-label="Admin navigation"><p className="nav-label">Manage</p><Link className="nav-item" href="/school-admin"><BookOpen size={18} /><span>Learning material</span></Link><Link className="nav-item" href="/school-admin/assignments"><ClipboardCheck size={18} /><span>Assignments</span></Link><Link className="nav-item active" href="/school-admin/tests"><FileQuestion size={18} /><span>Tests</span></Link><Link className="nav-item" href="/school-admin/registrations"><Users size={18} /><span>Registrations</span></Link></nav></aside>
    <section className="content-area"><header className="topbar"><div className="breadcrumb"><span>Manage</span><span>/</span><strong>Tests</strong></div><div className="topbar-actions"><AccountBadge /></div></header><div className="page-content"><section className="welcome-row"><div><p className="eyebrow">Assessment authoring</p><h1>Tests</h1><p className="welcome-copy">Schedule assessments for your students.</p></div></section>{error && <div className="learn-state learn-state-error"><p>{error}</p></div>}{message && <div className="learn-state"><p>{message}</p></div>}
      <section className="dashboard-grid"><form className="section-card" onSubmit={submit}><div className="card-heading"><div><p className="card-kicker">Create</p><h2>New test</h2></div><FileQuestion size={20} /></div>{subjects.length === 0 && <div className="learn-state learn-state-error"><p>No published subjects are available yet. Create one below before creating a test.</p><div><label className="admin-field">Subject name<input required value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g. Computer Science" /></label><label className="admin-field">Subject code<input required value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g. CS" pattern="[A-Za-z0-9_\-]+" /></label><button className="button button-primary" type="button" onClick={() => void createSubject()} disabled={subjectSaving || !subjectName.trim() || !subjectCode.trim()}>{subjectSaving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Create subject</button></div></div>}<label className="admin-field">Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. HTML fundamentals" /></label><label className="admin-field">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></label><div className="admin-form-row"><label className="admin-field">Subject<select required value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}><option value="" disabled>Select subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="admin-field">Class<select value={form.classLevel} onChange={(e) => setForm({ ...form, classLevel: e.target.value })}>{[9, 10, 11, 12].map((level) => <option key={level} value={level}>Class {level}</option>)}</select></label></div>{central && <><label className="admin-field">Scope<select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}><option value="GLOBAL">Global</option><option value="SCHOOL">School</option></select></label>{form.scope === "SCHOOL" && <label className="admin-field">School<select required value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}><option value="" disabled>Select school</option>{workspace.workspaces.filter((option) => option.mode === "SCHOOL_ADMIN").map((option) => <option key={option.schoolId} value={option.schoolId}>{option.label}</option>)}</select></label>}</>}<div className="admin-form-row"><label className="admin-field">Duration (minutes)<input required type="number" min="1" max="1440" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></label><label className="admin-field">Question count<input type="number" min="1" max="500" value={form.questionCount} onChange={(e) => setForm({ ...form, questionCount: e.target.value })} placeholder="Optional" /></label></div><div className="admin-form-row"><label className="admin-field">Starts<input required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label><label className="admin-field">Ends<input required type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label></div><label className="admin-field">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="LIVE">Live</option></select></label><label className="admin-field"><input type="checkbox" checked={form.randomizeQuestions} onChange={(e) => setForm({ ...form, randomizeQuestions: e.target.checked })} /> Randomize questions</label><label className="admin-field"><input type="checkbox" checked={form.randomizeOptions} onChange={(e) => setForm({ ...form, randomizeOptions: e.target.checked })} /> Randomize options</label><button className="primary-button" disabled={saving || !form.subjectId}>{saving ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />} {saving ? "Saving…" : "Create test"}</button></form>
      <section className="section-card"><div className="card-heading"><div><p className="card-kicker">Your workspace</p><h2>Test list</h2></div><FileQuestion size={20} /></div>{loading ? <div className="learn-state"><LoaderCircle size={22} className="spin" /><p>Loading tests…</p></div> : tests.length === 0 ? <div className="empty-state"><p>No tests yet.</p></div> : <div className="admin-list">{tests.map((test) => <article className="admin-list-item" key={test.id}><div><strong>{test.title}</strong><p>{test.subjectName} · Class {test.classLevel} · {test.scope === "GLOBAL" ? "Global" : test.schoolName ?? "School"} · {test.durationSeconds / 60} min</p><small>{new Date(test.startsAt).toLocaleString()} · {test.status}</small></div><div className="test-actions">      <span className="status-pill">{test.createdQuestionCount}/{test.questionCount ?? "—"} questions</span><select className="test-status-select" aria-label={`Status for ${test.title}`} value={test.status} onChange={(event) => void updateStatus(test, event.target.value)}><option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="LIVE">Live</option><option value="ENDED">Ended</option><option value="ARCHIVED">Archived</option></select><Link className="test-action-button" href={`/school-admin/tests/${test.id}`}>Manage questions</Link><button className="test-action-button test-delete-button" type="button" onClick={() => void deleteTest(test)}><Trash2 size={14} />Delete</button></div></article>)}</div>}</section></section>
    </div></section>
  </main>;
}

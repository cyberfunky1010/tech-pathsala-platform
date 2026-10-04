"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, BookOpen, CheckCircle2, FileQuestion, FileUp, GalleryHorizontalEnd, LoaderCircle, Plus, Sparkles, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { getApiData } from "@/lib/api/client";
import AccountBadge from "@/components/account-badge";
import SignOutButton from "@/components/sign-out-button";

type Material = {
  id: string;
  title: string;
  description: string | null;
  subjectName: string;
  classLevel: number;
  status: string;
  fileCount: number;
  files: Array<{ id: string; originalName: string; fileSize: number }>;
  canManage: boolean;
};

type Subject = { id: string; name: string; code: string };
type Account = { roles: string[]; workspace: { mode: string } };

export default function SchoolAdminLearningMaterial() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classLevel, setClassLevel] = useState("9");
  const [status, setStatus] = useState("DRAFT");
  const [scope, setScope] = useState<"SCHOOL" | "GLOBAL">("SCHOOL");
  const [account, setAccount] = useState<Account | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [materialResponse, subjectResponse, accountResponse] = await Promise.all([
        getApiData<{ data: Material[] }>("/api/v1/learning-material"),
        getApiData<{ data: Subject[] }>("/api/v1/subjects"),
        getApiData<{ data: Account }>("/api/v1/auth/me"),
      ]);
      setMaterials(materialResponse.data);
      setSubjects(subjectResponse.data);
      setAccount(accountResponse.data);
      if (subjectResponse.data[0]) {
        setSubjectId((current) => current || subjectResponse.data[0].id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The admin workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/learning-material", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          subjectId,
          classLevel: Number(classLevel),
          scope,
          status,
          streamIds: [],
        }),
      });
      const payload = await response.json() as { data?: Material; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Material could not be created.");

      if (file) {
        const formData = new FormData();
        formData.set("file", file);
        const upload = await fetch(`/api/v1/learning-material/${payload.data.id}/files`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!upload.ok) {
          const uploadPayload = await upload.json() as { error?: { message?: string } };
          await fetch(`/api/v1/learning-material/${payload.data.id}`, { method: "DELETE", credentials: "include" });
          throw new Error(uploadPayload.error?.message ?? "Material was created, but the file upload failed.");
        }

      }

      setTitle("");
      setDescription("");
      setFile(null);
      setMessage("Learning material created successfully.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Material could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMaterial(material: Material) {
    if (!window.confirm(`Delete "${material.title}"? This will also remove its attached files.`)) return;
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/v1/learning-material/${material.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error?.message ?? "Learning material could not be deleted.");
      return;
    }

    setMessage("Learning material deleted.");
    await load();
  }

  async function downloadFile(material: Material, file: Material["files"][number]) {
    setError(null);
    try {
      const response = await getApiData<{ data: { url: string } }>(`/api/v1/learning-material/${material.id}/files/${file.id}/download`);
      window.location.assign(response.data.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The file could not be downloaded.");
    }
  }

  const central = account?.roles.includes("CENTRAL_ADMIN") && account.workspace.mode === "CENTRAL_ADMIN";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div>
        <div className="profile-mini"><div className="avatar avatar-amber">SA</div><div><strong>School Admin</strong><span>Content workspace</span></div></div>
        <nav className="main-nav" aria-label="Admin navigation">
          <p className="nav-label">Manage</p>
          <Link className="nav-item active" href="/school-admin"><BookOpen size={18} /><span>Learning material</span></Link>
          <Link className="nav-item" href="/school-admin/assignments"><BookOpen size={18} /><span>Assignments</span></Link>
          <Link className="nav-item" href="/school-admin/tests"><FileQuestion size={18} /><span>Tests</span></Link><Link className="nav-item" href="/school-admin/registrations"><Users size={18} /><span>Registrations</span></Link>
          <Link className="nav-item" href="/school-admin/gallery"><GalleryHorizontalEnd size={18} /><span>Gallery</span></Link>
        </nav>
        <div className="sidebar-bottom"><div className="school-chip"><BookOpen size={18} /><span>Your school</span></div><SignOutButton /></div>
      </aside>
      <section className="content-area">
        <header className="topbar"><div className="breadcrumb"><span>Manage</span><span>/</span><strong>Learning material</strong></div><div className="topbar-actions"><AccountBadge /></div></header>
        <div className="page-content">
          <section className="welcome-row"><div><p className="eyebrow">School admin</p><h1>Learning material</h1><p className="welcome-copy">Create simple, useful resources for your students.</p></div><span className="stat-trend neutral">{materials.length} published materials</span></section>
          {error && <div className="learn-state learn-state-error"><p>{error}</p></div>}
          {message && <div className="learn-state"><CheckCircle2 size={20} /><p>{message}</p></div>}
          <section className="dashboard-grid">
            <form className="section-card" onSubmit={createMaterial}>
              <div className="card-heading"><div><p className="card-kicker">Create</p><h2>Add learning material</h2></div><Plus size={20} /></div>
              <label className="admin-field">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Introduction to HTML" /></label>
              <label className="admin-field">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will students learn?" rows={4} /></label>
              <div className="admin-form-row">
                <label className="admin-field">Subject<select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="" disabled>Select subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}</select></label>
                <label className="admin-field">Class<select value={classLevel} onChange={(event) => setClassLevel(event.target.value)}>{[9, 10, 11, 12].map((level) => <option key={level} value={level}>Class {level}</option>)}</select></label>
              </div>
              {central && <label className="admin-field">Scope<select value={scope} onChange={(event) => setScope(event.target.value as "SCHOOL" | "GLOBAL")}><option value="GLOBAL">Global</option><option value="SCHOOL">School</option></select></label>}
              <label className="admin-field">Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="DRAFT">Save as draft</option><option value="PUBLISHED">Publish now</option></select></label>
              <label className="admin-upload"><FileUp size={20} /><span>{file ? file.name : "Attach a file (optional, max 10 MB)"}</span><input type="file" accept=".pdf,application/pdf,.doc,.docx,.ppt,.pptx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
              <button className="primary-button" disabled={saving || !subjectId}>{saving ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />} {saving ? "Saving…" : "Create material"}</button>
            </form>
            <section className="section-card">
              <div className="card-heading"><div><p className="card-kicker">Your school</p><h2>Materials</h2></div><BookOpen size={20} /></div>
              {loading ? <div className="learn-state"><LoaderCircle size={22} className="spin" /><p>Loading materials…</p></div> : materials.length === 0 ? <div className="empty-learn"><BookOpen size={24} /><h3>No materials yet</h3><p>Create your first resource for students.</p></div> : <div className="admin-material-list">{materials.map((material) => <article className="admin-material-item" key={material.id}><div><span className="item-type">{material.subjectName} · Class {material.classLevel}</span><strong>{material.title}</strong><span>{material.status.toLowerCase()} · {material.fileCount} file{material.fileCount === 1 ? "" : "s"}</span>{material.files.map((file) => <button type="button" className="download-button admin-download-button" key={file.id} onClick={() => void downloadFile(material, file)}><ArrowDownToLine size={15} /> Download {file.originalName}</button>)}</div>{material.canManage && <button type="button" className="icon-button test-delete-button" onClick={() => void deleteMaterial(material)} aria-label={`Delete ${material.title}`}><Trash2 size={16} /></button>}</article>)}</div>}
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}

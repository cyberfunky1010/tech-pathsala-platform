"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ClipboardCheck, LoaderCircle, Plus, Sparkles, Users, X } from "lucide-react";
import Link from "next/link";
import { getApiData } from "@/lib/api/client";
import AccountBadge from "@/components/account-badge";

type Subject = { id: string; name: string; code: string };
type Assignment = { id: string; title: string; description: string | null; subjectName: string; classLevel: number; dueAt: string; status: string; submissionCount: number };
type Submission = { id: string; status: string; submittedAt: string | null; isLate: boolean; marks: number | null; maxMarks: number | null; feedback: string | null; student: { email: string | null; username: string | null; enrollment: { classLevel: number; admissionNumber: string } | null }; files: Array<{ id: string; originalName: string; fileSize: number }> };

export default function SchoolAdminAssignments() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classLevel, setClassLevel] = useState("9");
  const [dueAt, setDueAt] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [subjectResponse, assignmentResponse] = await Promise.all([
        getApiData<{ data: Subject[] }>("/api/v1/subjects"),
        getApiData<{ data: Assignment[] }>("/api/v1/assignments"),
      ]);
      setSubjects(subjectResponse.data);
      setAssignments(assignmentResponse.data);
      if (subjectResponse.data[0]) setSubjectId((current) => current || subjectResponse.data[0].id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Assignments could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/v1/assignments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || undefined, subjectId, classLevel: Number(classLevel), scope: "SCHOOL", dueAt: new Date(dueAt).toISOString(), status, streamIds: [] }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Assignment could not be created.");
      setTitle("");
      setDescription("");
      setDueAt("");
      setMessage("Assignment created successfully.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Assignment could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function openReview(assignment: Assignment) {
    setSelected(assignment);
    setReviewLoading(true);
    setReviewError(null);
    try {
      const response = await getApiData<{ data: Submission[] }>(`/api/v1/assignments/${assignment.id}/submissions`);
      setSubmissions(response.data);
    } catch (reason) {
      setReviewError(reason instanceof Error ? reason.message : "Submissions could not be loaded.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function evaluate(id: string, marks: number, maxMarks: number, feedback: string) {
    const response = await fetch(`/api/v1/assignment-submissions/${id}/evaluate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marks, maxMarks, feedback: feedback || undefined }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Evaluation could not be saved.");
    setMessage("Evaluation saved.");
    if (selected) await openReview(selected);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar"><div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div><div className="profile-mini"><div className="avatar avatar-amber">SA</div><div><strong>School Admin</strong><span>Content workspace</span></div></div><nav className="main-nav" aria-label="Admin navigation"><p className="nav-label">Manage</p><Link className="nav-item" href="/school-admin"><BookOpen size={18} /><span>Learning material</span></Link><Link className="nav-item active" href="/school-admin/assignments"><ClipboardCheck size={18} /><span>Assignments</span></Link><Link className="nav-item" href="/school-admin/registrations"><Users size={18} /><span>Registrations</span></Link></nav></aside>
      <section className="content-area"><header className="topbar"><div className="breadcrumb"><span>Manage</span><span>/</span><strong>Assignments</strong></div><div className="topbar-actions"><AccountBadge /></div></header><div className="page-content"><section className="welcome-row"><div><p className="eyebrow">School admin</p><h1>Assignments</h1><p className="welcome-copy">Give students a clear next step to practise.</p></div></section>{error && <div className="learn-state learn-state-error"><p>{error}</p></div>}{message && <div className="learn-state"><CheckCircle2 size={20} /><p>{message}</p></div>}
        <section className="dashboard-grid"><form className="section-card" onSubmit={submit}><div className="card-heading"><div><p className="card-kicker">Create</p><h2>New assignment</h2></div><Plus size={20} /></div><label className="admin-field">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Build a simple webpage" /></label><label className="admin-field">Instructions<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Tell students what to do." /></label><div className="admin-form-row"><label className="admin-field">Subject<select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="" disabled>Select subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="admin-field">Class<select value={classLevel} onChange={(event) => setClassLevel(event.target.value)}>{[9, 10, 11, 12].map((level) => <option key={level} value={level}>Class {level}</option>)}</select></label></div><label className="admin-field">Due date and time<input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><label className="admin-field">Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="DRAFT">Save as draft</option><option value="PUBLISHED">Publish now</option></select></label><button className="primary-button" disabled={saving || !subjectId}>{saving ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />} {saving ? "Saving…" : "Create assignment"}</button></form>
          <section className="section-card"><div className="card-heading"><div><p className="card-kicker">Your school</p><h2>Assignment list</h2></div><ClipboardCheck size={20} /></div>{loading ? <div className="learn-state"><LoaderCircle size={22} className="spin" /><p>Loading assignments…</p></div> : assignments.length === 0 ? <div className="empty-learn"><ClipboardCheck size={24} /><h3>No assignments yet</h3><p>Create one for your students.</p></div> : <div className="admin-material-list">{assignments.map((assignment) => <article className="admin-material-item" key={assignment.id}><div><span className="item-type">{assignment.subjectName} · Class {assignment.classLevel}</span><strong>{assignment.title}</strong><span>{assignment.status.toLowerCase()} · Due {new Date(assignment.dueAt).toLocaleString()} · {assignment.submissionCount} submissions</span><button className="text-button" type="button" onClick={() => void openReview(assignment)}>Review submissions</button></div></article>)}</div>}</section></section>
      </div></section>
      {selected && <div className="lesson-overlay" role="dialog" aria-modal="true" aria-label="Review submissions"><button className="overlay-scrim" aria-label="Close review" onClick={() => setSelected(null)} /><article className="lesson-drawer review-drawer"><button className="icon-button drawer-close" onClick={() => setSelected(null)} aria-label="Close review"><X size={19} /></button><p className="eyebrow">Review work</p><h2>{selected.title}</h2>{reviewError && <div className="learn-state learn-state-error"><p>{reviewError}</p></div>}{reviewLoading ? <div className="learn-state"><LoaderCircle size={22} className="spin" /><p>Loading submissions…</p></div> : submissions.length === 0 ? <div className="empty-learn"><ClipboardCheck size={22} /><h3>No submissions yet</h3><p>Student work will appear here.</p></div> : <div className="review-list">{submissions.map((submission) => <SubmissionReview key={submission.id} submission={submission} onEvaluate={evaluate} />)}</div>}</article></div>}
    </main>
  );
}

function SubmissionReview({ submission, onEvaluate }: { submission: Submission; onEvaluate: (id: string, marks: number, maxMarks: number, feedback: string) => Promise<void> }) {
  const [marks, setMarks] = useState(submission.marks?.toString() ?? "");
  const [maxMarks, setMaxMarks] = useState(submission.maxMarks?.toString() ?? "10");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const name = submission.student.username ?? submission.student.email ?? "Student";
  async function download(fileId: string) {
    const response = await getApiData<{ data: { url: string } }>(`/api/v1/submission-files/${fileId}/download`);
    window.open(response.data.url, "_blank", "noopener,noreferrer");
  }
  return <div className="review-item"><div className="review-student"><strong>{name}</strong><span>{submission.student.enrollment ? `Class ${submission.student.enrollment.classLevel} · Admission ${submission.student.enrollment.admissionNumber}` : "Student"}</span><span>{submission.submittedAt ? `Submitted ${new Date(submission.submittedAt).toLocaleString()}` : "Not submitted"}{submission.isLate ? " · Late" : ""}</span></div>{submission.files.map((file) => <button className="review-file review-file-button" type="button" key={file.id} onClick={() => void download(file.id)}>{file.originalName} · {Math.round(file.fileSize / 1024)} KB · Download</button>)}<div className="admin-form-row"><label className="admin-field">Marks<input type="number" min="0" value={marks} onChange={(event) => setMarks(event.target.value)} /></label><label className="admin-field">Out of<input type="number" min="1" value={maxMarks} onChange={(event) => setMaxMarks(event.target.value)} /></label></div><label className="admin-field">Feedback<textarea rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Share helpful feedback." /></label><button className="primary-button" type="button" onClick={() => void onEvaluate(submission.id, Number(marks), Number(maxMarks), feedback)}>Save evaluation</button></div>;
}

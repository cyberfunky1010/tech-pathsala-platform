"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, LoaderCircle } from "lucide-react";
import { getApiData } from "@/lib/api/client";

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  subjectName: string;
  classLevel: number;
  dueAt: string;
  submission: { status: string; submittedAt: string | null; isLate: boolean; marks: number | null } | null;
};

export default function StudentAssignments() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      const response = await getApiData<{ data: Assignment[] }>("/api/v1/assignments");
      setItems(response.data);
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

  async function submit(id: string, file?: File) {
    setSubmitting(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/assignments/${id}/submissions`, { method: "POST", credentials: "include" });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Submission could not be saved.");
      if (file) {
        const formData = new FormData();
        formData.set("file", file);
        const upload = await fetch(`/api/v1/assignments/${id}/submissions/files`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!upload.ok) {
          const uploadPayload = await upload.json() as { error?: { message?: string } };
          throw new Error(uploadPayload.error?.message ?? "Submission saved, but the file upload failed.");
        }
      }
      setMessage("Assignment submitted. Your teacher will review it soon.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Submission could not be saved.");
    } finally {
      setSubmitting(null);
    }
  }

  return <section className="assignments-page"><div className="welcome-row"><div><p className="eyebrow">Your work</p><h1>Assignments</h1><p className="welcome-copy">Small steps today make tomorrow easier.</p></div></div>{error && <div className="learn-state learn-state-error"><p>{error}</p></div>}{message && <div className="learn-state"><CheckCircle2 size={20} /><p>{message}</p></div>}{loading ? <div className="learn-state"><LoaderCircle size={24} className="spin" /><p>Loading your assignments…</p></div> : items.length === 0 ? <div className="empty-learn"><ClipboardCheck size={28} /><h3>You&apos;re all caught up</h3><p>There are no assignments for you right now.</p></div> : <div className="assignment-student-list">{items.map((item) => <AssignmentCard key={item.id} item={item} submitting={submitting === item.id} onSubmit={submit} />)}</div>}</section>;
}

function AssignmentCard({ item, submitting, onSubmit }: { item: Assignment; submitting: boolean; onSubmit: (id: string, file?: File) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  return <article className="section-card assignment-student-card"><div className="assignment-card-icon"><ClipboardCheck size={21} /></div><div className="assignment-card-main"><div className="material-topline"><span>{item.subjectName} · Class {item.classLevel}</span><span>{item.submission ? "Submitted" : "Not started"}</span></div><h2>{item.title}</h2><p>{item.description ?? "Review the instructions and submit your work before the due date."}</p><div className="assignment-meta"><span><Clock3 size={14} /> Due {new Date(item.dueAt).toLocaleString()}</span>{item.submission?.isLate && <span className="late-label">Submitted late</span>}</div>{!item.submission && <label className="admin-upload"><span>{file ? file.name : "Attach your work (optional, max 10 MB)"}</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>}</div><div>{item.submission ? <span className="done-label"><CheckCircle2 size={15} /> Submitted</span> : <button className="primary-button" onClick={() => void onSubmit(item.id, file ?? undefined)} disabled={submitting}>{submitting ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />} Submit</button>}</div></article>;
}

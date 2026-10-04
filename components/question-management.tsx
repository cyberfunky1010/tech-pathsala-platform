"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Check, ClipboardCheck, FileQuestion, LoaderCircle, Plus, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import AccountBadge from "@/components/account-badge";
import { getApiData } from "@/lib/api/client";

type Option = { id?: string; text: string; isCorrect: boolean; position?: number };
type Question = { id: string; text: string; marks: number; position: number; options: Option[] };

export default function QuestionManagement({ testId }: { testId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [marks, setMarks] = useState("1");
  const [options, setOptions] = useState<Option[]>([{ text: "", isCorrect: false }, { text: "", isCorrect: false }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getApiData<{ data: Question[] }>(`/api/v1/tests/${testId}/questions`);
      setQuestions(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Questions could not be loaded.");
    } finally { setLoading(false); }
  }, [testId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    try {
      const filledOptions = options.filter((option) => option.text.trim());
      if (filledOptions.length === 1) throw new Error("Add at least two options or leave options empty.");
      if (filledOptions.length > 0 && !filledOptions.some((option) => option.isCorrect)) throw new Error("Mark at least one correct option.");
      const response = await fetch(`/api/v1/tests/${testId}/questions`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, marks: Number(marks), options: filledOptions.length ? filledOptions : undefined }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Question could not be added.");
      setText(""); setMarks("1"); setOptions([{ text: "", isCorrect: false }, { text: "", isCorrect: false }]);
      setMessage("Question added."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Question could not be added."); }
    finally { setSaving(false); }
  }

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div><div className="profile-mini"><div className="avatar avatar-amber">SA</div><div><strong>School Admin</strong><span>Content workspace</span></div></div><nav className="main-nav" aria-label="Admin navigation"><p className="nav-label">Manage</p><Link className="nav-item" href="/school-admin"><BookOpen size={18} /><span>Learning material</span></Link><Link className="nav-item" href="/school-admin/assignments"><ClipboardCheck size={18} /><span>Assignments</span></Link><Link className="nav-item active" href="/school-admin/tests"><FileQuestion size={18} /><span>Tests</span></Link><Link className="nav-item" href="/school-admin/registrations"><Users size={18} /><span>Registrations</span></Link></nav></aside>
    <section className="content-area"><header className="topbar"><div className="breadcrumb"><Link href="/school-admin/tests">Tests</Link><span>/</span><strong>Questions</strong></div><div className="topbar-actions"><AccountBadge /></div></header><div className="page-content"><div className="welcome-row"><div><Link href="/school-admin/tests" className="button button-secondary"><ArrowLeft size={16} /> Back to tests</Link><p className="eyebrow">Assessment authoring</p><h1>Question management</h1><p className="welcome-copy">Add questions and optional answer choices to this test.</p></div></div>{error && <div className="learn-state learn-state-error"><p>{error}</p></div>}{message && <div className="learn-state"><p>{message}</p></div>}
      <section className="dashboard-grid"><form className="section-card" onSubmit={submit}><div className="card-heading"><div><p className="card-kicker">Create</p><h2>New question</h2></div><Plus size={20} /></div><label className="admin-field">Question text<textarea required value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder="Write the question…" /></label><label className="admin-field">Marks<input required type="number" min="0.1" step="0.1" value={marks} onChange={(event) => setMarks(event.target.value)} /></label><div className="card-heading"><div><p className="card-kicker">Optional</p><h3>Answer options</h3></div></div>{options.map((option, index) => <div className="admin-form-row" key={index}><label className="admin-field">Option {index + 1}<input value={option.text} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} /></label><label className="admin-field"><span>Correct answer</span><input type="checkbox" checked={option.isCorrect} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isCorrect: event.target.checked } : item))} /></label></div>)}<button className="button button-secondary" type="button" onClick={() => setOptions((current) => current.length < 10 ? [...current, { text: "", isCorrect: false }] : current)} disabled={options.length >= 10}><Plus size={16} /> Add option</button><button className="primary-button" type="submit" disabled={saving || !text.trim()}>{saving ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />} {saving ? "Saving…" : "Add question"}</button></form>
      <section className="section-card"><div className="card-heading"><div><p className="card-kicker">Test content</p><h2>{questions.length} question{questions.length === 1 ? "" : "s"}</h2></div><FileQuestion size={20} /></div>{loading ? <div className="learn-state"><LoaderCircle size={22} className="spin" /><p>Loading questions…</p></div> : questions.length === 0 ? <div className="empty-state"><p>No questions yet. Add the first one.</p></div> : <div className="admin-list">{questions.map((question) => <article className="admin-list-item" key={question.id}><div><strong>{question.position}. {question.text}</strong><p>{question.marks} mark{question.marks === 1 ? "" : "s"}</p>{question.options.length > 0 && <ol>{question.options.map((option) => <li key={option.id}>{option.text} {option.isCorrect && <strong>(correct)</strong>}</li>)}</ol>}</div></article>)}</div>}</section></section>
    </div></section>
  </main>;
}

"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock3, FileText, RefreshCw } from "lucide-react";
import { getApiData } from "@/lib/api/client";

type Test = {
  id: string; title: string; description: string | null; subject: { name: string };
  durationSeconds: number; startsAt: string; endsAt: string; _count: { questions: number };
  questionCount: number | null; attempt: { status: string; expiresAt: string } | null;
};

export default function StudentTests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Test | null>(null);

  function load() {
    setLoading(true);
    void getApiData<{ data: Test[] }>("/api/v1/tests")
      .then((response) => setTests(response.data))
      .catch(() => setMessage("Tests could not be loaded right now."))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function start(test: Test) {
    setStarting(test.id); setMessage("");
    const response = await fetch(`/api/v1/tests/${test.id}/start`, { method: "POST", credentials: "include" });
    const body = await response.json().catch(() => null);
    if (!response.ok) setMessage(body?.error?.message ?? "This test could not be started.");
    else window.location.assign(`/dashboard/tests/${test.id}`);
    setStarting(null);
  }

  return <section className="section-card" style={{ maxWidth: 900 }}>
    <div className="card-heading"><div><p className="card-kicker">Available now</p><h2>Your tests</h2></div><button className="icon-button" onClick={load} aria-label="Refresh tests"><RefreshCw size={17} /></button></div>
    {message && <p className="auth-error">{message}</p>}
    {loading ? <p className="muted-text">Loading available tests…</p> : tests.length === 0 ? <div className="empty-state"><Clock3 size={24} /><h3>No tests available right now</h3><p>Live tests appear here only during their scheduled time window.</p></div> : <div className="upcoming-list">
      {tests.map((test) => <div className="upcoming-item" key={test.id}>
        <div className="upcoming-icon coral"><FileText size={19} /></div>
        <div className="upcoming-main"><span className="item-type">{test.subject.name}</span><button className="link-button" onClick={() => setSelected(test)}><strong>{test.title}</strong></button><span>{test.questionCount ?? test._count.questions} questions · {Math.ceil(test.durationSeconds / 60)} min</span></div>
        <div className="upcoming-date"><button className="text-button" onClick={() => setSelected(test)}>{test.attempt?.status === "IN_PROGRESS" ? "Resume" : "Open"} <ArrowRight size={16} /></button></div>
      </div>)}
    </div>}
    {selected && <div className="detail-panel">
      <p className="card-kicker">{selected.subject.name}</p><h3>{selected.title}</h3>
      {selected.description && <p className="muted-text">{selected.description}</p>}
      <p className="muted-text"><Clock3 size={15} /> {Math.ceil(selected.durationSeconds / 60)} minutes · {selected.questionCount ?? selected._count.questions} questions</p>
      <button className="primary-button" disabled={starting === selected.id} onClick={() => void start(selected)}>{starting === selected.id ? "Starting…" : selected.attempt?.status === "IN_PROGRESS" ? "Resume attempt" : "Start test"} <ArrowRight size={16} /></button>
    </div>}
  </section>;
}

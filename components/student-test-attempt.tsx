"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";

type Option = { id: string; text: string; position: number };
type Question = { question: { id: string; text: string; marks: number; options: Option[] }; displayOrder: number };
type Attempt = {
  id: string; status: string; startedAt: string; expiresAt: string; submittedAt: string | null;
  marks?: number | null; maxMarks?: number | null; test: { title: string };
  questions: Question[]; answers: { questionId: string; selectedOptionId: string | null }[];
};

export default function StudentTestAttempt({ testId }: { testId: string }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = await fetch(`/api/v1/tests/${testId}/start`, { method: "POST", credentials: "include" });
      const startBody = await start.json().catch(() => null);
      if (!start.ok || !startBody?.data?.id) { setMessage(startBody?.error?.message ?? "This test could not be opened."); setLoading(false); return; }
      const response = await fetch(`/api/v1/attempts/${startBody.data.id}`, { credentials: "include" });
      const body = await response.json().catch(() => null);
      if (!cancelled && response.ok && body?.data) {
        setAttempt(body.data);
        setSeconds(Math.max(0, Math.ceil((new Date(body.data.expiresAt).getTime() - Date.now()) / 1000)));
      } else if (!cancelled) setMessage(body?.error?.message ?? "This attempt could not be loaded.");
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [testId]);

  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (attempt?.status === "IN_PROGRESS" && seconds === 0) void submit(true);
  // submit is intentionally defined below and only runs when the server timer expires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, attempt?.status]);

  const question = attempt?.questions[index];
  const selected = useMemo(() => question && attempt?.answers.find((answer) => answer.questionId === question.question.id)?.selectedOptionId, [attempt, question]);
  const timeLabel = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  async function choose(optionId: string) {
    if (!attempt || !question || attempt.status !== "IN_PROGRESS" || seconds === 0) return;
    setAttempt({ ...attempt, answers: [...attempt.answers.filter((answer) => answer.questionId !== question.question.id), { questionId: question.question.id, selectedOptionId: optionId }] });
    const response = await fetch(`/api/v1/attempts/${attempt.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: question.question.id, selectedOptionId: optionId }) });
    if (!response.ok) setMessage((await response.json().catch(() => null))?.error?.message ?? "Answer could not be saved.");
  }

  async function submit(timerExpired = false) {
    if (!attempt || submitting) return;
    if (!timerExpired && !window.confirm("Submit your test now? You will not be able to change your answers.")) return;
    setSubmitting(true);
    const response = await fetch(`/api/v1/attempts/${attempt.id}`, { method: "POST", credentials: "include" });
    const body = await response.json().catch(() => null);
    if (response.ok) {
      setAttempt({ ...attempt, ...body.data });
      router.push("/dashboard");
      return;
    }
    else setMessage(body?.error?.message ?? "The test could not be submitted.");
    setSubmitting(false);
  }

  return <main className="auth-shell"><section className="auth-form-panel"><div className="auth-form-wrap">
    <Link className="button button-secondary" href="/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link>
    {loading && <div className="learn-state"><LoaderCircle size={22} className="spin" /><p>Opening your test…</p></div>}
    {!loading && message && !attempt && <div className="learn-state learn-state-error"><h3>Test unavailable</h3><p>{message}</p><Link className="primary-button" href="/dashboard">Return to dashboard</Link></div>}
    {attempt && attempt.status !== "IN_PROGRESS" && <div className="learn-state"><CheckCircle2 size={30} /><h2>{attempt.status === "EXPIRED" ? "Attempt expired" : "Test submitted"}</h2>{attempt.marks != null && <p className="result-score">Score: {attempt.marks} / {attempt.maxMarks}</p>}<Link className="primary-button" href="/dashboard">Back to tests</Link></div>}
    {attempt && attempt.status === "IN_PROGRESS" && question && <div className="test-player">
      <div className="card-heading"><div><p className="card-kicker">{attempt.test.title}</p><h2>Question {index + 1} of {attempt.questions.length}</h2></div><strong className={seconds < 60 ? "auth-error" : ""}><Clock3 size={17} /> {timeLabel}</strong></div>
      {message && <p className="auth-error">{message}</p>}<div className="test-question-card"><span className="card-kicker">Question {index + 1}</span><p className="test-question">{question.question.text}</p><span className="test-marks">{question.question.marks} mark{question.question.marks === 1 ? "" : "s"}</span></div>
      <div className="test-options" role="radiogroup" aria-label={`Answers for question ${index + 1}`}>{question.question.options.map((option, optionIndex) => <button type="button" key={option.id} className={`test-option ${selected === option.id ? "selected" : ""}`} role="radio" aria-checked={selected === option.id} onClick={() => void choose(option.id)}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option.text}</span></button>)}</div>
      <div className="test-navigation">{attempt.questions.map((item, itemIndex) => <button key={item.question.id} className={itemIndex === index ? "active" : ""} onClick={() => setIndex(itemIndex)}>{itemIndex + 1}</button>)}</div>
      <div className="test-actions"><button className="button button-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>{index < attempt.questions.length - 1 ? <button className="primary-button" onClick={() => setIndex(index + 1)}>Next</button> : <button className="primary-button" disabled={submitting} onClick={() => void submit()}>{submitting ? "Submitting…" : "Submit test"}</button>}</div>
    </div>}
  </div></section></main>;
}

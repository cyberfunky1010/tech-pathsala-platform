"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, FileText, RefreshCw } from "lucide-react";
import { getApiData } from "@/lib/api/client";

type Result = {
  id: string;
  title: string;
  subject: string;
  marks: number | null;
  maxMarks: number | null;
  percentage: number | null;
  attemptNumber: number;
  completedBy: string;
  status: "SUBMITTED" | "AUTO_SUBMITTED" | "EXPIRED";
  submittedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not submitted";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function StudentResults() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadResults() {
    setLoading(true);
    setError(null);
    void getApiData<{ data: Result[] }>("/api/v1/results")
      .then((response) => setResults(response.data))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Results could not be loaded."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(loadResults, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="section-card results-card" aria-labelledby="results-heading">
      <div className="card-heading">
        <div><p className="card-kicker">Your progress</p><h2 id="results-heading">Test results</h2></div>
        <button type="button" className="icon-button muted" onClick={loadResults} aria-label="Refresh results" disabled={loading}><RefreshCw size={17} /></button>
      </div>
      {loading ? <p className="results-message">Loading your results…</p> : error ? <p className="results-message results-error">{error}</p> : results.length === 0 ? (
        <div className="results-empty"><FileText size={22} /><p>Submitted test results will appear here.</p></div>
      ) : (
        <div className="results-list">
          {results.map((result) => {
            const completed = result.status !== "EXPIRED";
            const statusLabel = result.status === "AUTO_SUBMITTED" ? "Auto-submitted" : result.status === "EXPIRED" ? "Expired" : "Submitted";
            return <article className="result-item" key={result.id}>
              <div className={`result-icon ${completed ? "result-icon-complete" : "result-icon-expired"}`}>{completed ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}</div>
              <div className="result-main">
                <strong>{result.title}</strong>
                <span>{result.subject}</span>
                <small>Attempt {result.attemptNumber} by {result.completedBy}</small>
              </div>
              <div className="result-score">
                {result.marks == null || result.maxMarks == null ? <strong>—</strong> : <><strong>{result.marks} / {result.maxMarks}</strong><span>{result.percentage}%</span></>}
                <small>{statusLabel} · {formatDate(result.submittedAt)}</small>
              </div>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}

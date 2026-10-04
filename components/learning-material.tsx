"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowRight, BookOpen, Check, Clock3, FileText, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { getApiData } from "@/lib/api/client";

type Material = {
  id: string;
  title: string;
  subject: string;
  description: string;
  duration: string;
  level: string;
  accent: string;
  progress: number;
  featured?: boolean;
  files: Array<{ id: string; originalName: string; mimeType: string; fileSize: number }>;
};

type MaterialResponse = { data: Array<{ id: string; title: string; subjectName: string; description: string | null; classLevel: number; fileCount: number; files: Material["files"] }> };

export default function LearningMaterial() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("All subjects");
  const [selected, setSelected] = useState<Material | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getApiData<MaterialResponse>("/api/v1/learning-material")
      .then((response) => {
        if (!active) return;
        setMaterials(response.data.map((item, index) => ({
          id: item.id,
          title: item.title,
          subject: item.subjectName,
          description: item.description ?? "Open this learning material to get started.",
          duration: item.fileCount ? `${item.fileCount} attached file${item.fileCount === 1 ? "" : "s"}` : "Reading material",
          level: `Class ${item.classLevel}`,
          accent: ["blue", "coral", "green", "lilac"][index % 4],
          progress: 0,
          files: item.files,
        })));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Learning material could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => materials.filter((item) => {
    const matchesQuery = `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (subject === "All subjects" || item.subject === subject);
  }), [materials, query, subject]);

  return (
    <>
      <div className="learn-header">
        <div><p className="eyebrow">Your library</p><h1>Learn something new</h1><p className="welcome-copy">Short, focused lessons made for your next step.</p></div>
        <div className="learn-stats"><div><strong>12</strong><span>completed</span></div><div><strong>3</strong><span>in progress</span></div></div>
      </div>
      <div className="learn-toolbar">
        <label className="learn-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search learning material" aria-label="Search learning material" /></label>
        <div className="filter-row" role="group" aria-label="Filter by subject">
          {["All subjects", "Computer Science", "Mathematics", "English"].map((item) => <button key={item} className={subject === item ? "filter-active" : ""} onClick={() => setSubject(item)}>{item}</button>)}
        </div>
      </div>
      {loading && <div className="learn-state"><LoaderCircle size={24} className="spin" /><p>Loading your learning material…</p></div>}
      {error && !loading && <div className="learn-state learn-state-error"><BookOpen size={24} /><h3>We couldn&apos;t open your library</h3><p>{error}</p><button className="text-button" onClick={() => window.location.reload()}>Try again <ArrowRight size={15} /></button></div>}
      {!loading && !error && materials.length > 0 && <section className="learn-featured">
        <div className="featured-copy"><div className="featured-label"><Sparkles size={14} /> Ready when you are</div><h2>{materials[0].title}</h2><p>{materials[0].description}</p><button className="primary-button" onClick={() => setSelected(materials[0])}>Open lesson <ArrowRight size={16} /></button></div>
        <div className="featured-illustration"><div className="code-card"><span>.hero</span><i>{"{"}</i><em>color: #5274ee;</em><i>{"}"}</i></div><div className="float-dot dot-one" /><div className="float-dot dot-two" /></div>
      </section>}
      <div className="learn-section-heading"><div><p className="card-kicker">For your class</p><h2>Learning material</h2></div><span>{filtered.length} lessons</span></div>
      {!loading && !error && (filtered.length === 0 ? <div className="empty-learn"><BookOpen size={26} /><h3>No lessons found</h3><p>Try a different search or subject.</p></div> : <div className="material-grid">{filtered.map((item) => <MaterialCard key={item.title} material={item} onOpen={() => setSelected(item)} />)}</div>)}
      {selected && <div className="lesson-overlay" role="dialog" aria-modal="true" aria-label={selected.title}><button className="overlay-scrim" aria-label="Close lesson" onClick={() => setSelected(null)} /><article className="lesson-drawer"><button className="icon-button drawer-close" onClick={() => setSelected(null)} aria-label="Close lesson"><X size={19} /></button><div className={`drawer-art ${selected.accent}`}><BookOpen size={38} /></div><p className="eyebrow">{selected.subject} · {selected.level}</p><h2>{selected.title}</h2><p>{selected.description}</p><div className="drawer-meta"><span><Clock3 size={15} /> {selected.duration}</span><span><FileText size={15} /> Learning material</span></div>{selected.files.length > 0 && <div className="drawer-files"><p className="card-kicker">Attached resources</p>{selected.files.map((file) => <DownloadButton key={file.id} materialId={selected.id} file={file} />)}</div>}<button className="primary-button drawer-cta" onClick={() => setSelected(null)}>{selected.progress > 0 ? "Continue reading" : "Start lesson"} <ArrowRight size={16} /></button></article></div>}
    </>
  );
}

function DownloadButton({ materialId, file }: { materialId: string; file: { id: string; originalName: string; fileSize: number } }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const response = await getApiData<{ data: { url: string } }>(`/api/v1/learning-material/${materialId}/files/${file.id}/download`);
      window.location.assign(response.data.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The file could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return <div className="drawer-file"><div><strong>{file.originalName}</strong><span>{Math.max(1, Math.round(file.fileSize / 1024))} KB</span></div><button type="button" className="download-button" onClick={() => void download()} disabled={downloading}><ArrowDownToLine size={16} />{downloading ? "Preparing…" : "Download"}</button>{error && <small className="download-error">{error}</small>}</div>;
}

function MaterialCard({ material, onOpen }: { material: Material; onOpen: () => void }) {
  return <button className="material-card" onClick={onOpen}><div className={`material-art ${material.accent}`}><BookOpen size={22} /></div><div className="material-card-body"><div className="material-topline"><span>{material.subject}</span><span>{material.level}</span></div><h3>{material.title}</h3><p>{material.description}</p><div className="material-footer"><span><Clock3 size={13} /> {material.duration}</span>{material.progress > 0 && <span className="material-progress"><span style={{ width: `${material.progress}%` }} /></span>}{material.progress === 100 && <Check size={14} className="complete-check" />}</div></div></button>;
}

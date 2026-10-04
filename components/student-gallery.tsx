"use client";

import { useEffect, useState } from "react";
import { GalleryHorizontalEnd, LoaderCircle } from "lucide-react";
import { getApiData } from "@/lib/api/client";

type Gallery = { id: string; type: "PUBLIC" | "SCHOOL"; title: string; description: string | null; schoolName: string | null; items: { id: string; url: string | null; caption: string | null }[] };

export default function StudentGallery({ publicOnly = false }: { publicOnly?: boolean }) {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getApiData<{ data: Gallery[] }>(publicOnly ? "/api/v1/galleries?type=PUBLIC" : "/api/v1/galleries").then((result) => setGalleries(result.data)).catch((reason) => setError(reason instanceof Error ? reason.message : "Gallery could not be loaded.")).finally(() => setLoading(false)); }, [publicOnly]);
  if (loading) return <div className="learn-state"><LoaderCircle className="spin" /><p>Loading gallery…</p></div>;
  if (error) return <div className="learn-state learn-state-error"><p>{error}</p></div>;
  if (!galleries.length) return <div className="empty-learn"><GalleryHorizontalEnd size={28} /><h3>No gallery moments yet</h3><p>School memories and announcements will appear here.</p></div>;
  return <section className="gallery-grid">{galleries.map((gallery) => <article className="section-card gallery-card" key={gallery.id}><div className="card-heading"><div><p className="card-kicker">{gallery.type === "PUBLIC" ? "PathSala" : gallery.schoolName ?? "Your school"}</p><h2>{gallery.title}</h2></div></div>{gallery.description && <p className="welcome-copy">{gallery.description}</p>}<div className="gallery-images">{gallery.items.map((item) => item.url ? <figure key={item.id}><img src={item.url} alt={item.caption ?? gallery.title} /><figcaption>{item.caption}</figcaption></figure> : null)}</div></article>)}</section>;
}

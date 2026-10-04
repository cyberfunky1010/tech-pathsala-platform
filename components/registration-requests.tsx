"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ClipboardCheck, LoaderCircle, UserCheck, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import { getApiData } from "@/lib/api/client";
import AccountBadge from "@/components/account-badge";

type Request = { id: string; email: string; fullName: string; schoolCode: string; academicYearName: string; admissionNumber: string; classLevel: number; status: string; createdAt: string };

export default function RegistrationRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      const response = await getApiData<{ data: Request[] }>("/api/v1/students/registration-requests");
      setRequests(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration requests could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function approve(request: Request) {
    const response = await fetch(`/api/v1/students/registration-requests/${request.id}/approve`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolCode: request.schoolCode, academicYearName: request.academicYearName, admissionNumber: request.admissionNumber, classLevel: request.classLevel }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) {
      setError(payload.error?.message ?? "The request could not be approved.");
      return;
    }
    setMessage(`${request.fullName} is now approved as a student.`);
    await load();
  }

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div><div className="profile-mini"><div className="avatar avatar-amber">SA</div><div><strong>School Admin</strong><span>Student approvals</span></div></div><nav className="main-nav" aria-label="Admin navigation"><p className="nav-label">Manage</p><Link className="nav-item" href="/school-admin"><BookOpen size={18} /><span>Learning material</span></Link><Link className="nav-item" href="/school-admin/assignments"><ClipboardCheck size={18} /><span>Assignments</span></Link><Link className="nav-item active" href="/school-admin/registrations"><Users size={18} /><span>Registrations</span></Link></nav></aside><section className="content-area"><header className="topbar"><div className="breadcrumb"><span>Manage</span><span>/</span><strong>Registrations</strong></div><div className="topbar-actions"><AccountBadge /></div></header><div className="page-content"><section className="welcome-row"><div><p className="eyebrow">School admin</p><h1>Student registrations</h1><p className="welcome-copy">Review new student accounts before they enter the school space.</p></div></section>{error && <div className="learn-state learn-state-error"><p>{error}</p></div>}{message && <div className="learn-state"><CheckCircle2 size={20} /><p>{message}</p></div>}{loading ? <div className="learn-state"><LoaderCircle size={22} className="spin" /><p>Loading requests…</p></div> : requests.length === 0 ? <div className="empty-learn"><UserCheck size={26} /><h3>No pending requests</h3><p>New student registrations will appear here.</p></div> : <div className="admin-material-list">{requests.map((request) => <article className="section-card registration-item" key={request.id}><div><p className="card-kicker">{request.email}</p><h2>{request.fullName}</h2><p>Class {request.classLevel} · Admission {request.admissionNumber} · {request.academicYearName}</p><span>Requested {new Date(request.createdAt).toLocaleString()}</span></div><button className="primary-button" onClick={() => void approve(request)}><UserCheck size={16} /> Approve</button></article>)}</div>}</div></section></main>;
}

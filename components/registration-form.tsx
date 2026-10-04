"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function RegistrationForm() {
  const [fields, setFields] = useState({ fullName: "", schoolCode: "", academicYearName: "", admissionNumber: "", classLevel: "9" });
  const [status, setStatus] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const response = await fetch("/api/v1/students/registration", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, classLevel: Number(fields.classLevel) }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Registration request could not be sent.");
      return;
    }
    setSuccess(true);
  }

  return <main className="auth-shell"><section className="auth-brand-panel"><div className="brand auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div><div className="auth-message"><p className="eyebrow">One simple step</p><h1>Tell us where<br /><em>you learn.</em></h1><p>Your school administrator will review these details and connect your account.</p></div></section><section className="auth-form-panel"><div className="auth-form-wrap"><p className="eyebrow">Student registration</p><h2>Request school approval</h2>{success ? <div className="learn-state"><h3>Request sent</h3><p>Your school administrator can now review your request. We&apos;ll show your learning space after approval.</p><Link className="primary-button" href="/dashboard">Try dashboard <ArrowRight size={16} /></Link></div> : <form onSubmit={submit} className="auth-form"><label>Full name<input required value={fields.fullName} onChange={(event) => setFields({ ...fields, fullName: event.target.value })} /></label><label>School ID<input required value={fields.schoolCode} onChange={(event) => setFields({ ...fields, schoolCode: event.target.value })} placeholder="Provided by your school" /></label><label>Academic year<input required value={fields.academicYearName} onChange={(event) => setFields({ ...fields, academicYearName: event.target.value })} placeholder="e.g. 2026-27" /></label><div className="admin-form-row"><label className="admin-field">Admission number<input required value={fields.admissionNumber} onChange={(event) => setFields({ ...fields, admissionNumber: event.target.value })} /></label><label className="admin-field">Class<select value={fields.classLevel} onChange={(event) => setFields({ ...fields, classLevel: event.target.value })}>{[9, 10, 11, 12].map((level) => <option key={level} value={level}>Class {level}</option>)}</select></label></div>{status && <p className="auth-error" role="alert">{status}</p>}<button className="primary-button auth-submit">Send approval request <ArrowRight size={16} /></button></form>}<p className="auth-help">Need to sign in first? <Link href="/login">Go to sign in</Link></p></div></section></main>;
}

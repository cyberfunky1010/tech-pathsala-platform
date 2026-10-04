"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      if (next === "/school-admin" || next === "/dashboard" || next === "/register" || next === "/central-admin") {
        router.push(next);
        return;
      }
      const accountResponse = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (accountResponse.ok) {
        const payload = await accountResponse.json() as { data?: { accountType?: string } };
        router.push(payload.data?.accountType === "Central Admin" ? "/central-admin" : "/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED"
          ? "Login is not configured yet. Add the Supabase values from .env.example."
          : "We could not sign you in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <div className="brand auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div>
        <div className="auth-message"><p className="eyebrow">A calmer way to learn</p><h1>Small steps.<br /><em>Big confidence.</em></h1><p>Everything you need to learn, practise, and grow — in one simple space.</p></div>
        <div className="auth-quote"><span>“</span><p>Learning feels better when you always know what to do next.</p></div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">Welcome back</p>
          <h2>Let&apos;s continue learning</h2>
          <p className="auth-copy">Sign in to open your Tech Pathsala space.</p>
          <form onSubmit={submit} className="auth-form">
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.com" required /></label>
            <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required minLength={6} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {status && <p className="auth-error" role="alert">{status}</p>}
            <button className="primary-button auth-submit" disabled={loading}>{loading ? "Signing you in…" : "Sign in"} {!loading && <ArrowRight size={16} />}</button>
          </form>
          <p className="auth-help">Need an account? <Link href="/signup">Create one here</Link>, then ask your school administrator to approve your registration.</p>
        </div>
      </section>
    </main>
  );
}

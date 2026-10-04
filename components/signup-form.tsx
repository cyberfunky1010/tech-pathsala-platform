"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/register`,
        },
      });
      if (error) {
        const message = error.message.toLowerCase();
        setStatus(
          message.includes("redirect") || message.includes("not allowed")
            ? "Signup is blocked because the confirmation redirect is not allowed. Add http://localhost:3000/auth/callback to Supabase Authentication URL Configuration → Redirect URLs."
            : error.message,
        );
        return;
      }
      if (data.user && data.user.identities?.length === 0) {
        setStatus("This email already has a PathSala account. Sign in instead, or use a different email address.");
        return;
      }
      if (data.session) {
        setStatus("Your account was created. Ask your school administrator to connect your student profile.");
      } else {
        setSuccess(true);
      }
    } catch (error) {
      setStatus(error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED" ? "Signup is not configured yet." : "We could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-shell"><section className="auth-brand-panel"><div className="brand auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div><div className="auth-message"><p className="eyebrow">Start simply</p><h1>Your next step<br /><em>starts here.</em></h1><p>Create an account, then your school can connect you to the right learning space.</p></div></section><section className="auth-form-panel"><div className="auth-form-wrap"><p className="eyebrow">Create account</p><h2>Join PathSala</h2><p className="auth-copy">Use your email and create a secure password.</p>{success ? <div className="learn-state"><h3>Check your email</h3><p>We sent a confirmation link. After confirming, sign in and ask your school administrator to approve your profile.</p>    <Link className="primary-button" href="/login?next=/register">Continue to registration <ArrowRight size={16} /></Link></div> : <form onSubmit={submit} className="auth-form"><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.com" required /></label><label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" required minLength={6} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{status && <p className="auth-error" role="alert">{status}</p>}<button className="primary-button auth-submit" disabled={loading}>{loading ? "Creating account…" : "Create account"} {!loading && <ArrowRight size={16} />}</button></form>}<p className="auth-help">Already have an account? <Link href="/login">Sign in</Link></p></div></section></main>;
}

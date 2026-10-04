"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight, BarChart3, BookOpen, CheckCircle2, ChevronRight,
  ClipboardCheck, Clock3, FileText, GalleryHorizontalEnd, GraduationCap,
  LayoutDashboard, Menu, MoreHorizontal, Search, Settings, Sparkles, Trophy,
} from "lucide-react";
import LearningMaterial from "@/components/learning-material";
import StudentAssignments from "@/components/student-assignments";
import StudentTests from "@/components/student-tests";
import StudentResults from "@/components/student-results";
import StudentGallery from "@/components/student-gallery";
import AccountBadge from "@/components/account-badge";
import SignOutButton from "@/components/sign-out-button";
import { getApiData } from "@/lib/api/client";

type Account = {
  username: string | null;
  email: string | null;
  accountType: string;
  roles: string[];
  student: { name: string | null; classLevel: number; academicYear: string; schoolName: string | null } | null;
};

type NavItem = { label: string; icon: typeof LayoutDashboard };

const navItems: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Learn", icon: BookOpen },
  { label: "Assignments", icon: ClipboardCheck },
  { label: "Tests", icon: FileText },
  { label: "Results", icon: BarChart3 },
  { label: "Gallery", icon: GalleryHorizontalEnd },
];

const upcoming = [
  { title: "HTML & CSS basics", type: "Test", meta: "20 questions · 30 min", date: "Tomorrow", color: "coral" },
  { title: "Build a simple webpage", type: "Assignment", meta: "Computer Science", date: "Oct 08", color: "lilac" },
];

export default function Dashboard() {
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getApiData<{ data: Account }>("/api/v1/auth/me")
        .then((response) => setAccount(response.data))
        .catch(() => setAccount(null))
        .finally(() => setAccountLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const displayName = account?.username?.trim() || account?.email?.split("@")[0] || "Student";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const enrollmentLabel = account?.student
    ? `Class ${account.student.classLevel} · ${account.student.academicYear}`
    : "Student account";

  async function openWorkspace(mode: "CENTRAL_ADMIN" | "SCHOOL_ADMIN") {
    const response = await fetch("/api/v1/auth/workspace", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (response.ok) window.location.assign(mode === "CENTRAL_ADMIN" ? "/central-admin" : "/school-admin");
  }

  if (accountLoading) {
    return <main className="auth-shell"><section className="auth-form-panel"><div className="auth-form-wrap"><p className="eyebrow">Tech Pathsala</p><h2>Loading your learning space…</h2></div></section></main>;
  }

  if (!account) {
    return <main className="auth-shell"><section className="auth-form-panel"><div className="auth-form-wrap"><p className="eyebrow">Account setup</p><h2>Your account is not provisioned yet</h2><p className="auth-copy">Your Supabase account exists, but PathSala has not connected it to a student or administrator profile. Ask a school administrator to approve your registration.</p><SignOutButton className="primary-button auth-submit" /></div></section></main>;
  }

  if (!account.student && !account.roles.includes("STUDENT")) {
    return <main className="auth-shell"><section className="auth-form-panel"><div className="auth-form-wrap"><p className="eyebrow">{account.accountType}</p><h2>This is an administrator account</h2><p className="auth-copy">Choose an administrator workspace to continue.</p><div className="auth-form">{account.roles.includes("CENTRAL_ADMIN") && <button type="button" className="primary-button auth-submit" onClick={() => void openWorkspace("CENTRAL_ADMIN")}>Open Central Admin <ArrowRight size={16} /></button>}{account.roles.includes("SCHOOL_ADMIN") && <button type="button" className="primary-button auth-submit" onClick={() => void openWorkspace("SCHOOL_ADMIN")}>Open School Admin <ArrowRight size={16} /></button>}<SignOutButton className="primary-button auth-submit" /></div></div></section></main>;
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><span>pathsala</span></div>
        <div className="profile-mini">
          <div className="avatar avatar-amber">{initials}</div>
          <div><strong>{displayName}</strong><span>{enrollmentLabel}</span></div>
          <button className="icon-button muted" aria-label="Open profile menu"><MoreHorizontal size={18} /></button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">My space</p>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => { setActive(label); setMenuOpen(false); }}>
              <Icon size={18} /><span>{label}</span>{label === "Assignments" && <span className="nav-count">2</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card"><div className="streak-icon">✦</div><div><strong>4 day streak</strong><span>Keep it going!</span></div></div>
          <button className="nav-item"><Settings size={18} /><span>Settings</span></button>
          <div className="school-chip"><GraduationCap size={18} /><span>St. Xavier&apos;s School</span></div>
        </div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <section className="content-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
          <div className="breadcrumb"><span>My space</span><ChevronRight size={15} /><strong>{active}</strong></div>
          <div className="topbar-actions">
            <AccountBadge />
            <button className="search-button" aria-label="Search"><Search size={18} /><span>Search anything</span><kbd>⌘ K</kbd></button>
            <button className="notification-button" aria-label="Notifications"><span className="notification-dot" /><span>♢</span></button>
            <div className="avatar avatar-small avatar-amber">{initials}</div>
          </div>
        </header>
        <div className={`page-content ${active === "Learn" ? "learn-page" : ""}`}>
          {active === "Learn" ? <LearningMaterial /> : active === "Assignments" ? <StudentAssignments /> : active === "Tests" ? <StudentTests /> : active === "Results" ? <StudentResults /> : active === "Gallery" ? <StudentGallery /> : <>
          <section className="welcome-row">
            <div><p className="eyebrow">Wednesday, October 04, 2026</p><h1>Good morning, {displayName} <span className="wave">✦</span></h1><p className="welcome-copy">A little progress every day adds up to big things.</p></div>
            <button className="primary-button"><BookOpen size={17} />Continue learning<ArrowRight size={16} /></button>
          </section>
          <section className="stats-grid" aria-label="Your progress">
            <StatCard tone="warm" icon={<Trophy size={18} />} value="78%" label="Average score" trend="↗ 8% this month" />
            <StatCard tone="blue" icon={<BookOpen size={18} />} value="12" label="Lessons completed" trend="↗ 3 this week" />
            <StatCard tone="lilac" icon={<ClipboardCheck size={18} />} value="2" label="Pending assignments" trend="Due this week" neutral />
            <StatCard tone="green" icon={<Clock3 size={18} />} value="4h 20m" label="Learning time" trend="↗ 24m this week" />
          </section>
          <section className="dashboard-grid">
            <div className="section-card progress-card">
              <div className="card-heading"><div><p className="card-kicker">Your progress</p><h2>Keep going, you&apos;re doing great!</h2></div><button className="text-button">View results <ArrowRight size={15} /></button></div>
              <div className="progress-layout">
                <div className="progress-ring" aria-label="78 percent average score"><div><strong>78</strong><span>%</span><small>average</small></div></div>
                <div className="subject-list"><ProgressRow label="Computer Science" score={86} color="blue" /><ProgressRow label="Mathematics" score={74} color="coral" /><ProgressRow label="English" score={69} color="green" /></div>
              </div>
              <div className="encouragement"><span>✦</span><p>You&apos;re <strong>12% ahead</strong> of your last month&apos;s average.</p></div>
            </div>
            <div className="section-card today-card">
              <div className="card-heading"><div><p className="card-kicker">Up next</p><h2>Today&apos;s plan</h2></div><button className="icon-button muted" aria-label="More options"><MoreHorizontal size={19} /></button></div>
              <div className="today-list">
                <TodayItem kind="done" icon={<CheckCircle2 size={17} />} title="Review Python variables" meta="Computer Science · 20 min" end={<span className="done-label">Done</span>} />
                <TodayItem kind="current" icon={<BookOpen size={17} />} title="Read: CSS selectors" meta="Computer Science · 15 min" end={<button className="round-arrow" aria-label="Start lesson"><ArrowRight size={15} /></button>} />
                <TodayItem kind="next" icon={<ClipboardCheck size={17} />} title="Finish your assignment" meta="Due tomorrow" end={<span className="later-label">Later</span>} />
              </div>
            </div>
          </section>
          <section className="section-card upcoming-card">
            <div className="card-heading"><div><p className="card-kicker">Don&apos;t miss these</p><h2>Coming up</h2></div><button className="text-button">See all <ArrowRight size={15} /></button></div>
            <div className="upcoming-list">{upcoming.map((item) => <div className="upcoming-item" key={item.title}><div className={`upcoming-icon ${item.color}`}>{item.type === "Test" ? <FileText size={19} /> : <ClipboardCheck size={19} />}</div><div className="upcoming-main"><span className="item-type">{item.type}</span><strong>{item.title}</strong><span>{item.meta}</span></div><div className="upcoming-date"><span>{item.date}</span><ChevronRight size={16} /></div></div>)}</div>
          </section>
          </>}
        </div>
      </section>
    </main>
  );
}

function StatCard({ tone, icon, value, label, trend, neutral = false }: { tone: string; icon: React.ReactNode; value: string; label: string; trend: string; neutral?: boolean }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-icon">{icon}</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><span className={`stat-trend ${neutral ? "neutral" : ""}`}>{trend}</span></div>;
}

function ProgressRow({ label, score, color }: { label: string; score: number; color: string }) {
  return <div className="progress-row"><div><span className={`dot dot-${color}`} /><strong>{label}</strong><span className="score">{score}%</span></div><div className="progress-track"><span className={`progress-fill fill-${color}`} style={{ width: `${score}%` }} /></div></div>;
}

function TodayItem({ kind, icon, title, meta, end }: { kind: string; icon: React.ReactNode; title: string; meta: string; end: React.ReactNode }) {
  return <div className="today-item"><div className={`today-marker ${kind}`}>{icon}</div><div><strong>{title}</strong><span>{meta}</span></div>{end}</div>;
}

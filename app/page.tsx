import StudentGallery from "@/components/student-gallery";

export default function Home() {
  return (
    <main className="public-home">
      <header className="public-nav">
        <div className="brand"><div className="brand-mark">✦</div><span>pathsala</span></div>
        <a className="text-button" href="/login">Sign in <span>→</span></a>
      </header>
      <section className="public-hero">
        <div className="public-hero-copy"><p className="eyebrow">Learning, made clear</p><h1>Make progress<br /><em>feel simple.</em></h1><p>PathSala gives schools and students one calm, friendly place to learn, practise, and celebrate every step forward.</p><a className="primary-button" href="/login">Enter your learning space <span>→</span></a></div>
        <div className="public-hero-art"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-card"><div className="hero-card-top"><span>Today&apos;s progress</span><strong>78%</strong></div><div className="hero-bar"><i /></div><div className="hero-card-bottom"><span>✦ 4 day streak</span><span>+8% this month</span></div></div></div>
      </section>
      <section className="public-features"><div><span>01</span><strong>Learn with focus</strong><p>Short, useful lessons made for real progress.</p></div><div><span>02</span><strong>Know what&apos;s next</strong><p>Assignments and tests, without the confusion.</p></div><div><span>03</span><strong>Grow together</strong><p>A simpler school experience for everyone.</p></div></section>
      <section className="public-gallery-section"><div className="public-gallery-heading"><div><p className="eyebrow">From our community</p><h2>Moments worth celebrating</h2></div><a className="text-button" href="/gallery">View gallery <span>→</span></a></div><StudentGallery publicOnly /></section>
    </main>
  );
}

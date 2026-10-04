import StudentGallery from "@/components/student-gallery";

export default function PublicGalleryPage() {
  return (
    <main className="page-content">
      <section className="welcome-row">
        <div><p className="eyebrow">PathSala</p><h1>Gallery</h1><p className="welcome-copy">Explore moments from the PathSala community.</p></div>
      </section>
      <StudentGallery publicOnly />
    </main>
  );
}

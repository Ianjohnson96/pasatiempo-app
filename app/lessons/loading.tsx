// Shown the instant a tab is tapped, while the server reads the book.
// Without it the old screen sat frozen until the new one was ready, which
// read as the app ignoring the tap.
export default function LessonsLoading() {
  return (
    <main className="container" aria-busy="true" aria-label="Loading">
      <div className="lb-skel" style={{ height: 44, maxWidth: 300 }} />
      <div className="lb-skel-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="lb-skel" style={{ height: 68 }} />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="lb-skel" style={{ height: 96, marginTop: 12 }} />
      ))}
    </main>
  );
}

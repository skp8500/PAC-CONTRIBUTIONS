export default function HomePage() {
  return (
    <main
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        maxWidth: "840px",
        margin: "0 auto",
        padding: "48px 24px",
        lineHeight: 1.6,
      }}
    >
      <h1>PAC-CONTRIBUTIONS Backend</h1>
      <p>
        This project exposes a production-ready contributions API for the
        Pac-Man frontend animation.
      </p>
      <p>
        Try <code>/api/contributions/torvalds</code> after starting the Next.js
        server.
      </p>
    </main>
  );
}

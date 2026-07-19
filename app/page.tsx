import "./globals.css";
import { SECTIONS } from "@/lib/sections";

// Root landing. On production custom domains the proxy rewrites to the section,
// so this mainly serves localhost as a dev directory of sections.
export default function Home() {
  return (
    <main className="wrap">
      <p className="eyebrow">Pasatiempo</p>
      <h1>Pasatiempo App</h1>
      <p className="lead">
        Umbrella app. Each section below has its own custom domain and its own
        isolated data, all under one project. This index is for local
        development.
      </p>

      {SECTIONS.map((s) => (
        <a key={s.key} className="card" href={s.pathPrefix}>
          <h3>{s.label}</h3>
          <span>
            {s.pathPrefix} · schema <code>{s.schema}</code>
          </span>
        </a>
      ))}

      <a className="card" href="/admin">
        <h3>Admin</h3>
        <span>/admin · manage every section</span>
      </a>
    </main>
  );
}

import Link from "next/link";

export default function AppBar({
  admin = false,
  email,
}: {
  admin?: boolean;
  email?: string | null;
}) {
  return (
    <header className="appbar">
      <div className="appbar-inner">
        <Link href={admin ? "/admin/events" : "/"} className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" />
          Pasatiempo Events
        </Link>
        <span className="spacer" />
        {admin && (
          <Link href="/admin/events" className="navlink">
            All events
          </Link>
        )}
        {email && (
          <>
            <span className="navlink u-email" style={{ opacity: 0.85 }}>
              {email}
            </span>
            <form action="/auth/signout" method="post" style={{ margin: 0 }}>
              <button type="submit" className="navlink" style={{ background: "none", border: "none", cursor: "pointer", font: "inherit" }}>
                Sign out
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sectionForHost, isAdminHost, SECTIONS } from "@/lib/sections";
import { siteForPath } from "@/lib/hub/apps";
import { isSuperAdmin, siteIsOn } from "@/lib/hub/sites";
import { safeNext } from "@/lib/hub/next";

// ===========================================================================
// Proxy (Next.js 16's renamed "middleware"). Two jobs:
//
//  1) RESOLVE the internal route for the incoming request:
//       - admin domain (admin.pasatiempo.com)  -> everything under /admin
//       - a section domain (events.…, mhi.…)   -> everything under /events, /mhi
//       - anything else (localhost, the umbrella *.vercel.app, unknown host)
//         -> served BY PATH as-is (/events, /mhi, /admin, /login, …)
//     This lets the same deployment serve separate custom domains later while
//     still working today on one .vercel.app by path.
//
//  2) GATE the admin area: any request whose RESOLVED path is under /admin
//     requires a signed-in Supabase user — no matter which host it came in on.
// ===========================================================================

function isLoginPath(p: string): boolean {
  return p === "/login" || p.startsWith("/login/");
}

function isAdminPath(p: string): boolean {
  return p === "/admin" || p.startsWith("/admin/");
}

// The caddie portal. Caddies are not Supabase Auth users — they carry their own
// cookie (see lib/caddie/session.ts), so the staff gate below does not apply to
// them. This is only a cheap presence check to save a pointless render; the
// pages themselves verify the session against the database.
function isCaddiePath(p: string): boolean {
  return p === "/caddie" || p.startsWith("/caddie/");
}

// Public inside the portal: the QR landing page, and the portal's own front
// door, which explains how to get a link when you arrive without one.
function isCaddiePublicPath(p: string): boolean {
  return p === "/caddie" || p.startsWith("/caddie/join/");
}

// A static-HTML section (e.g. El Sombrero) served straight from /public — either
// because the request came in on that section's domain, or by path prefix.
function staticSectionFor(host: string | null, path: string) {
  const byHost = sectionForHost(host);
  if (byHost?.staticFile) return byHost;
  return SECTIONS.find(
    (s) =>
      s.staticFile &&
      (path === s.pathPrefix || path.startsWith(s.pathPrefix + "/")),
  );
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // --- 0) Static-HTML sections (public, no auth): serve the file directly ---
  const staticSec = staticSectionFor(host, path);
  if (staticSec?.staticFile) {
    url.pathname = staticSec.staticFile;
    return NextResponse.rewrite(url);
  }

  // --- 1) Resolve the internal path + whether we need to rewrite -----------
  let internalPath = path;
  let needsRewrite = false;

  if (isAdminHost(host)) {
    // Dedicated admin domain: map its root onto /admin (leave /login alone).
    if (!isAdminPath(path) && !isLoginPath(path)) {
      internalPath = "/admin" + (path === "/" ? "" : path);
      needsRewrite = true;
    }
  } else {
    const section = sectionForHost(host);
    if (section && !path.startsWith(section.pathPrefix)) {
      // Section custom domain: map its root onto the section's prefix.
      internalPath = section.pathPrefix + (path === "/" ? "" : path);
      needsRewrite = true;
    }
    // Otherwise (localhost / umbrella .vercel.app / unknown): path as-is.
  }

  // --- 1a) Caddie portal: its own cookie, not Supabase Auth ----------------
  if (isCaddiePath(internalPath) && !isCaddiePublicPath(internalPath)) {
    if (!request.cookies.get("caddie_session")) {
      const redirect = url.clone();
      redirect.pathname = "/caddie";
      return NextResponse.redirect(redirect);
    }
  }

  // --- 2) Refresh the Supabase auth session --------------------------------
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Helper: carry any refreshed auth cookies onto a redirect/rewrite response.
  const withCookies = (res: NextResponse) => {
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // --- 3) Staff gate: the admin area AND the hub root (the section directory)
  //        require a signed-in user. Public visitors reach the individual
  //        sections directly (/mhi, /events/…, /sombrero) — never the hub. ----
  // --- 2a) Public sites the super admin has switched off ------------------
  //         Visitors get the "not available" page; super admins still see it.
  const site = isAdminPath(internalPath) ? null : siteForPath(internalPath);
  if (site && !(await siteIsOn(site)) && !(await isSuperAdmin(user?.email))) {
    url.pathname = "/unavailable";
    return withCookies(NextResponse.rewrite(url, { request }));
  }

  // Signing in only proves who someone is; what each app lets them do is
  // checked by that app (lib/hub/access.ts).
  const staffOnly = isAdminPath(internalPath) || internalPath === "/";
  if (staffOnly && !user) {
    const redirect = url.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    if (internalPath !== "/" && internalPath !== "/admin") redirect.searchParams.set("next", internalPath);
    return withCookies(NextResponse.redirect(redirect));
  }
  if (isLoginPath(internalPath) && user) {
    const redirect = url.clone();
    redirect.pathname = safeNext(url.searchParams.get("next")) ?? "/admin";
    redirect.search = "";
    return withCookies(NextResponse.redirect(redirect));
  }

  // --- 4) Apply the host->path rewrite if needed ---------------------------
  if (needsRewrite) {
    url.pathname = internalPath;
    return withCookies(NextResponse.rewrite(url, { request }));
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

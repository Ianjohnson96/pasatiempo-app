import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sectionForHost, isAdminHost, SECTIONS } from "@/lib/sections";

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

  // --- 3) Admin gate (keyed on the RESOLVED internal path) -----------------
  if (isAdminPath(internalPath) && !user) {
    const redirect = url.clone();
    redirect.pathname = "/login";
    return withCookies(NextResponse.redirect(redirect));
  }
  if (isLoginPath(internalPath) && user) {
    const redirect = url.clone();
    redirect.pathname = "/admin";
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

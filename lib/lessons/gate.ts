// Run a page's reads alongside its access check, but let the check speak first.
//
// The reads cannot wait for the gate - that waterfall is what made the book
// slow - and they do not need to: RLS already returns nothing to a stranger.
// But for a signed-out visitor the reads FAIL (lesson_dashboard is not
// granted to anon), and a plain Promise.all rejects with whichever settles
// first. Then the visitor sees a permission error instead of the sign-in
// page, depending on which network call won. Awaiting the gate first makes
// its redirect the answer every time.
export async function gateFirst<V, T>(
  gate: Promise<V>,
  load: Promise<T>,
): Promise<[V, T]> {
  // Mark the read as handled now; if the gate rejects we never await it, and
  // an unobserved rejection would otherwise be reported as unhandled.
  load.catch(() => {});
  const viewer = await gate;
  return [viewer, await load];
}

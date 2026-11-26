"use client";

// "Already entered? Manage your registration" under the hero buttons, so a
// returning member doesn't scroll past the whole form to find it. It opens
// the "Already signed up?" panel lower down (ManageRegistration listens for
// ep:manage) and takes them there.
export default function ManageLink({ tournament }: { tournament: boolean }) {
  return (
    <p className="hero-manage">
      {tournament ? "Already entered?" : "Already signed up?"}{" "}
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("ep:manage", { detail: { email: "" } }))
        }
      >
        Manage your registration
      </button>
    </p>
  );
}

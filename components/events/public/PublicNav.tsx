// The sign-up page's top bar: the event's logo. Shared with the editor preview.
export default function PublicNav({ logo }: { logo: string }) {
  return (
    <nav className="pub-nav">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="Pasatiempo Golf Club" />
    </nav>
  );
}

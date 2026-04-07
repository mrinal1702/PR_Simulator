import Link from "next/link";
import { GAME_TAGLINE, GAME_TITLE } from "@/lib/onboardingContent";

export default function HomePage() {
  return (
    <div className="shell">
      <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <p
          className="muted"
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontSize: "0.72rem",
            marginBottom: "0.75rem",
          }}
        >
          Simulation · PR · Questionable decisions
        </p>
        <h1
          style={{
            fontSize: "clamp(1.65rem, 5vw, 2.35rem)",
            margin: "0 auto 1rem",
            maxWidth: "22ch",
          }}
        >
          {GAME_TITLE}
        </h1>
        <p
          className="muted"
          style={{
            margin: "0 auto",
            maxWidth: "36rem",
            fontSize: "1.05rem",
            lineHeight: 1.6,
          }}
        >
          {GAME_TAGLINE}
        </p>
        <p className="muted" style={{ margin: "1rem auto 0", fontSize: "0.88rem" }}>
          One save slot. Make it count.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          maxWidth: "320px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <button
          type="button"
          className="btn btn-secondary"
          disabled
          aria-disabled="true"
          title="Coming soon"
        >
          Continue
        </button>
        <p className="muted" style={{ margin: "-0.35rem 0 0", fontSize: "0.8rem", textAlign: "center" }}>
          Coming soon — loads your single saved run.
        </p>
        <Link href="/game/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          New game
        </Link>
      </div>

      <footer style={{ marginTop: "auto", paddingTop: "3rem", textAlign: "center" }}>
        <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
          Not financial advice. Not real PR. Definitely not your lawyer.
        </p>
      </footer>
    </div>
  );
}

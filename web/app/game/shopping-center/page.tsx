import Link from "next/link";
import { GAME_TITLE } from "@/lib/onboardingContent";

export default function ShoppingCenterPage() {
  return (
    <div className="end-season-profit-shell">
      <p className="end-season-profit-muted">
        <Link href="/">← {GAME_TITLE}</Link>
      </p>
      <div className="end-season-profit-card">
        <p className="end-season-profit-kicker">Shopping Center</p>
        <h1 className="end-season-profit-headline" style={{ fontSize: "1.35rem" }}>
          Coming soon
        </h1>
        <p className="end-season-profit-sub">This area is not wired up yet.</p>
      </div>
    </div>
  );
}

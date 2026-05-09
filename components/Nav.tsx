import Link from "next/link";
import { BookOpen, MessageCircle, Sparkles, User, Users } from "lucide-react";

import ReaderHud from "./ReaderHud";

export default function Nav() {
  return (
    <nav className="nav-shell">
      <div className="nav-inner">
        <Link href="/" className="nav-wordmark">
          ComfyReads
        </Link>

        <div className="flex items-center gap-3">
          <ReaderHud variant="compact" />
          <Link
            href="/shelf"
            title="My Shelf"
            aria-label="My Shelf"
            className="nav-link"
          >
            <BookOpen size={20} strokeWidth={1.75} />
          </Link>
          <Link
            href="/recommendations"
            title="For You"
            aria-label="For You"
            className="nav-link"
          >
            <Sparkles size={20} strokeWidth={1.75} />
          </Link>
          <Link
            href="/friends"
            title="Friends"
            aria-label="Friends"
            className="nav-link"
          >
            <Users size={20} strokeWidth={1.75} />
          </Link>
          <Link
            href="/agent"
            title="Shelf Agent"
            aria-label="Shelf Agent"
            className="nav-link"
          >
            <MessageCircle size={20} strokeWidth={1.75} />
          </Link>
          <Link
            href="/stats"
            title="Your Stats"
            aria-label="Your Stats"
            className="nav-link"
          >
            <User size={20} strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </nav>
  );
}

import Landing from "@/components/Landing";

// The public front page. This used to be the Scenario Builder (moved to
// /builder — see app/(tool)/builder/page.tsx and its own comment) and,
// before that restructuring, there was no real front page in this codebase
// at all: TopNav's logo linked out to a separate claude.ai-hosted artifact
// as a stand-in "homepage." Landing is that artifact's design, ported in as
// an actual route — see components/Landing.tsx for the full story.
export default function HomePage() {
  return <Landing />;
}

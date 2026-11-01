// Club landing page — the club's public blog (/clubs/:id). Unlike a writer
// profile, this is a masthead-style masthead page: the club's identity on top,
// every post the club has published underneath, attributed to the club.
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import EmptyState from "../../profile/components/EmptyState";
import { StoryCard } from "../../../components/ui/StoryCard";
import { blogToStory } from "../../blog/lib/blog-story";
import type { Story } from "../../profile/types/story.types";
import type { BlogResponseDTO, ClubDTO, ClubRole } from "@quill/shared";
import { getClubLandingApi } from "../api/club.api";
import { assetUrl } from "../../auth/api/auth.api";

const CLUB_COLORS = ["#1F3D2F", "#B27D56", "#5C6B4F", "#7A4E3A", "#3B5248"];
const clubColor = (id: string) =>
  CLUB_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % CLUB_COLORS.length];

const RoleBadge = ({ role }: { role: ClubRole | null }) =>
  role ? (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] ${
        role === "admin"
          ? "bg-[#1F3D2F] text-white"
          : "bg-[#F0EDE4] text-[#1F3D2F] border border-[#D9D4C5]"
      }`}
    >
      {role === "admin" ? (
        <>
          <Crown className="w-3 h-3" /> Admin
        </>
      ) : role === "moderator" ? (
        <>
          <ShieldCheck className="w-3 h-3" /> Moderator
        </>
      ) : (
        "Member"
      )}
    </span>
  ) : null;

const ClubBlogsPage = () => {
  const [club, setClub] = useState<ClubDTO | null>(null);
  const [posts, setPosts] = useState<BlogResponseDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const clubId = window.location.pathname.split("/")[2] ?? "";
    (async () => {
      try {
        const result = await getClubLandingApi(clubId, { limit: 50 });
        if (!active) return;
        setClub(result.club);
        setPosts(result.posts);
        setTotal(result.total);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
          <p className="text-[14px] text-[#8A8F8B]">Loading the club…</p>
        </main>
      </AppShell>
    );
  }

  if (notFound || !club) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
          <EmptyState
            title="Club not found"
            body="This club doesn't exist, or it is invite-only and you're not a member."
            ctaLabel="Back to my clubs"
            ctaTo="/my-clubs"
          />
        </main>
      </AppShell>
    );
  }

  const stories: Story[] = posts.map((b) => blogToStory(b));

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 md:py-10">
        <Link
          to="/my-clubs"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#5C625E] hover:text-[#1F3D2F] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> My clubs
        </Link>

        {/* Club masthead */}
        <header className="mt-6 border-b border-[#E6E2D6] pb-8">
          <div className="flex items-start gap-4">
            <div
              className="shrink-0 rounded-2xl font-editorial text-white flex items-center justify-center select-none h-16 w-16 text-[28px]"
              style={{ background: clubColor(club.id) }}
            >
              {club.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] uppercase tracking-widest text-[#8A8F8B]">
                Club publication
              </p>
              <h1 className="font-editorial text-[34px] sm:text-[44px] leading-[1.1] tracking-tight text-[#1B1F1C]">
                {club.name}
              </h1>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#5C625E]">
            {club.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-[#8A8F8B]">
            <RoleBadge role={club.role} />
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {club.memberCount} members
            </span>
            {club.privacy === "invite" && <span>· Invite-only club</span>}
            <span>· {total} published {total === 1 ? "post" : "posts"}</span>
          </div>
        </header>

        {/* Every published post of the club, newest first */}
        <section className="mt-4">
          {stories.length === 0 ? (
            <EmptyState
              title="Nothing published yet"
              body="Approved writing from this club will appear here."
              ctaLabel="Back to my clubs"
              ctaTo="/my-clubs"
            />
          ) : (
            <div className="flex flex-col">
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} hideAuthor={!story.isMine} />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
};

export default ClubBlogsPage;

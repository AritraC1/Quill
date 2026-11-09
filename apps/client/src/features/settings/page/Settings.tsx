import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Database,
  ShieldCheck,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "../../../components/layout/AppShell";
import { useOwnProfile } from "../../profile/hooks/useOwnProfile";
import { getMeApi } from "../../profile/api/profile.api";
import { useAuth } from "../../auth";
import { assetUrl } from "../../auth/api/auth.api";
import { loadStoredUser } from "../../../lib/user-store";
import {
  deleteAccountApi,
  getSettingsApi,
  saveSettingsApi,
} from "../api/settings.api";
import { SETTINGS_GENRES, TEXT_SIZE_RANGE } from "@quill/shared";
import type {
  FeedTab,
  NotificationKey,
  Preferences,
  ReadingTheme,
  SectionId,
} from "../types/settings.types";
import Button from "../components/Button";
import PageHeading from "../components/PageHeading";
import Card from "../components/Card";
import Row from "../components/Row";
import Badge from "../components/Badge";
import Note from "../components/Note";
import Switch from "../components/Switch";

const SECTIONS: { id: SectionId; label: string; Icon: LucideIcon }[] = [
  { id: "account", label: "Account", Icon: User },
  { id: "profile", label: "Profile", Icon: UserRound },
  { id: "reading", label: "Reading", Icon: BookOpen },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "privacy", label: "Privacy and security", Icon: ShieldCheck },
  { id: "data", label: "Data and account", Icon: Database },
];

// Genre chips — same list the server exports, so they cannot drift
const GENRES: string[] = [...SETTINGS_GENRES];

const THEME_PREVIEW: Record<ReadingTheme, [string, string]> = {
  light: ["#FFFFFF", "#1B1F1C"],
  sepia: ["#F4EFE3", "#3B3224"],
  dark: ["#1B211D", "#E6E2D8"],
};

// Seed shown while GET /user/settings is in flight and as the reset basis;
// values match the server defaults in migration 012 exactly
const DEFAULT_PREFS: Preferences = {
  genres: [],
  defaultTab: "for-you",
  textSize: TEXT_SIZE_RANGE.default,
  theme: "light",
  notifications: {
    appPosts: true,
    appFollowers: true,
    appScheduled: true,
    appReplies: false,
    emailDigest: true,
    emailFollowers: false,
    emailNews: false,
  },
};

const isSection = (v: string | null): v is SectionId =>
  SECTIONS.some((s) => s.id === v);

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-full bg-[#EAE6DD] p-0.75"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-full px-4 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
            value === o.value
              ? "bg-white text-[#1F3D2F] shadow-sm"
              : "text-[#5C625E] hover:text-[#1B1F1C]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delete-account dialog                                               */
/* ------------------------------------------------------------------ */

const DeleteAccountDialog = ({
  handle,
  busy,
  onCancel,
  onConfirm,
}: {
  handle: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = handle !== "" && typed.trim().replace(/^@/, "") === handle;

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      className="fixed inset-0 z-50 grid place-items-center bg-[#1B1F1C]/45 p-4"
    >
      <div className="w-full max-w-110 rounded-2xl bg-white p-6">
        <h2
          id="delete-title"
          className="font-editorial text-[22px] text-[#1B1F1C]"
        >
          Delete your account?
        </h2>
        <p className="mt-2 mb-4 text-[14px] text-[#5C625E]">
          This cannot be undone. Type your handle{" "}
          <b className="text-[#1B1F1C]">{handle || "your handle"}</b> to
          confirm.
        </p>
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          aria-label="Type your handle to confirm"
          placeholder={handle}
          className="mb-5 h-10 w-full rounded-lg border border-[#E6E2D8] px-3 text-[14px] outline-none focus:border-[#1F3D2F]"
        />
        <div className="flex justify-end gap-2.5">
          <Button onClick={onCancel}>Keep my account</Button>
          <Button
            variant="danger"
            disabled={!matches || busy}
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const SettingsPage = () => {
  const navigate = useNavigate();
  const own = useOwnProfile();
  const { logout, isLoading: isAuthWorking } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  const sectionParam = searchParams.get("section");
  const section: SectionId = isSection(sectionParam) ? sectionParam : "account";

  const [saved, setSaved] = useState<Preferences>(DEFAULT_PREFS);
  const [draft, setDraft] = useState<Preferences>(DEFAULT_PREFS);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // Reference equality = "the user hasn't edited anything yet", used to
  // decide whether the API response may overwrite the in-memory copies
  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  useEffect(() => {
    draftRef.current = draft;
    savedRef.current = saved;
  }, [draft, saved]);

  const handle = own.profile.handle ?? "";
  const name = own.profile.name || "Quill writer";
  const bio = own.profile.bio ?? "";
  //Authenticated account data: the email captured at sign-up until
  //GET /user/me answers (never exposed through public profile responses)
  const [email, setEmail] = useState(() => loadStoredUser()?.email ?? "");

  useEffect(() => {
    let cancelled = false;
    getMeApi()
      .then((me) => {
        if (!cancelled && me.email) setEmail(me.email);
      })
      .catch(() => {
        /* sign-up email fallback stays until the API answers */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the saved preference snapshot when the page opens (page seeds from
  // DEFAULT_PREFS already; the response replaces the states if untouched)
  useEffect(() => {
    let cancelled = false;
    getSettingsApi()
      .then((data) => {
        if (cancelled) return;
        // Someone is mid-edit: don't wipe their draft with the stored copy
        if (draftRef.current === savedRef.current) {
          setSaved(data);
          setDraft(data);
        }
      })
      .catch(() => {
        /* offline — the page stays on its defaults, saving still tries */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleGenre = (g: string) =>
    update(
      "genres",
      draft.genres.includes(g)
        ? draft.genres.filter((x) => x !== g)
        : [...draft.genres, g],
    );

  const setNotification = (key: NotificationKey, on: boolean) =>
    update("notifications", { ...draft.notifications, [key]: on });

  const goTo = (id: SectionId) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", id);
    setSearchParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Persist the full snapshot; the server returns the canonical copy
      const data = await saveSettingsApi(draft);
      setSaved(data);
      setDraft(data);
      showToast("Changes saved");
    } catch (error) {
      // Draft stays dirty so nothing typed is lost, and the error shows
      showToast(
        error instanceof Error && error.message
          ? error.message
          : "Could not save changes",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // scope "device" revokes only this browser's session; other devices
      // keep working
      await logout("device");
      navigate("/");
    } catch {
      showToast("Could not sign out. Try again.");
    }
  };

  const handleSignOutEverywhere = async () => {
    if (
      !window.confirm("Sign out of Quill on every device, including this one?")
    )
      return;
    try {
      // scope "all" revokes every refresh token — every device is signed out
      await logout("all");
      navigate("/");
    } catch {
      showToast("Could not sign out on other devices. Try again.");
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // The server deletes the account in one transaction (profile, drafts,
      // bookmarks, published posts, follows, sessions) and clears cookies
      const result = await deleteAccountApi();
      setConfirmDelete(false);
      // logout() clears the local session state AND the stale profile cache
      await logout();
      showToast(
        result.publishedPosts
          ? `Account deleted — ${result.publishedPosts} published post${
              result.publishedPosts === 1 ? "" : "s"
            } removed`
          : "Account deleted",
      );
      await logout(); // clear the local session state
      navigate("/");
    } catch (error) {
      setConfirmDelete(false);
      showToast(
        error instanceof Error && error.message
          ? error.message
          : "Could not delete your account",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const previewColors = THEME_PREVIEW[draft.theme];

  const notificationRows: {
    key: NotificationKey;
    title: string;
    description?: string;
  }[][] = [
    [
      { key: "appPosts", title: "New posts from writers you follow" },
      {
        key: "appFollowers",
        title: "Follows and club invitations",
        description: "When someone follows you or invites you to a club.",
      },
      {
        key: "appScheduled",
        title: "Scheduled post published",
        description: "Know when a post you scheduled goes live.",
      },
      {
        key: "appReplies",
        title: "Replies to your comments",
        description: "Mentions are not available yet.",
      },
    ],
    [
      {
        key: "emailDigest",
        title: "Weekly digest",
        description:
          "A short summary of the best posts from writers you follow.",
      },
      { key: "emailFollowers", title: "New followers" },
      {
        key: "emailNews",
        title: "Product updates",
        description: "Unavailable until Quill launches a product newsletter.",
      },
    ],
  ];

  return (
    <AppShell
      searchQuery={searchQuery}
      onSearchChange={(v: string) => {
        setSearchQuery(v);
        navigate(v ? `/feed?q=${encodeURIComponent(v)}` : "/feed");
      }}
    >
      {toast && (
        <div
          role="status"
          className="animate-fade-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1B1F1C] px-4 py-2.5 text-[13px] font-medium text-white shadow-xl sm:bottom-6"
        >
          {toast}
        </div>
      )}

      <main className="mx-auto grid max-w-270 grid-cols-1 gap-6 px-4 py-6 pb-28 sm:px-6 md:grid-cols-12 md:gap-12 md:py-8">
        {/* Section nav */}
        <nav aria-label="Settings sections" className="md:col-span-3">
          <div className="md:sticky md:top-24">
            <h2 className="font-editorial mb-3 hidden text-[22px] text-[#1B1F1C] md:block">
              Settings
            </h2>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0.5 md:px-0">
              {SECTIONS.map(({ id, label, Icon }) => {
                const active = section === id;
                return (
                  <li key={id} className="shrink-0">
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => goTo(id)}
                      className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-medium transition-colors md:rounded-lg md:border-transparent md:px-3 ${
                        active
                          ? "border-[#1F3D2F] bg-[#1F3D2F] text-white md:bg-[#E4EEE8] md:text-[#1F3D2F]"
                          : "border-[#E6E2D8] bg-white text-[#5C625E] hover:text-[#1B1F1C] md:bg-transparent md:hover:bg-[#EAE6DD]"
                      }`}
                    >
                      <Icon className="hidden h-4.5 w-4.5 md:block" />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Panels */}
        <div className="min-w-0 md:col-span-9">
          {section === "account" && (
            <>
              <PageHeading
                title="Account"
                lead="Your sign-in details and account status."
              />
              <Card>
                <Row title="Email address" description={email}>
                  <Button disabled>
                    Change email <Badge>Soon</Badge>
                  </Button>
                </Row>
                <Row
                  title="Account status"
                  description="Your account is in good standing and can publish posts."
                >
                  <Badge tone="ok">Active</Badge>
                </Row>
                <Row
                  title="Sign-in method"
                  description="We email you a one-time code each time you sign in. There is no password to remember."
                >
                  <Badge tone="neutral">Email code</Badge>
                </Row>
              </Card>
              <Card>
                <Row
                  title="Sign out"
                  description="Sign out of Quill on this device."
                >
                  <Button disabled={isAuthWorking} onClick={() => void handleSignOut()}>
                    Sign out
                  </Button>
                </Row>
                <Row
                  title="Delete account"
                  description="Permanently remove your account and content. Find this under Data and account."
                >
                  <Button variant="outlineDanger" onClick={() => goTo("data")}>
                    Go to delete options
                  </Button>
                </Row>
              </Card>
            </>
          )}

          {section === "profile" && (
            <>
              <PageHeading
                title="Profile"
                lead="How other readers see you on Quill."
              />
              <Card>
                <div className="flex flex-wrap items-center gap-4 p-5">
                  <span className="font-editorial flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1F3D2F]/10 text-[24px] text-[#1F3D2F]">
                    {assetUrl(own.profile.avatarUrl) ? (
                      <img
                        src={assetUrl(own.profile.avatarUrl)}
                        alt={`${name}’s photo`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      name[0]
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-editorial text-[20px] leading-tight text-[#1B1F1C]">
                      {name}
                    </div>
                    <div className="text-[13px] text-[#8A8F8B]">
                      {handle ? `@${handle}` : "No handle yet"}
                    </div>
                    {bio && (
                      <p className="mt-1.5 max-w-[56ch] text-[14px] text-[#1B1F1C]">
                        {bio}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/profile/edit"
                    className="inline-flex h-9 items-center rounded-full bg-[#1F3D2F] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A5240]"
                  >
                    Edit profile
                  </Link>
                </div>
                <div className="px-5 py-4">
                  <Note>
                    Display name, bio, avatar and website are edited on your
                    profile page, so there is one place to update them.
                  </Note>
                </div>
              </Card>
              <Card title="Handle">
                <Row
                  stacked
                  description={`Your handle is part of your profile link: quill.app/${
                    handle ? `@${handle}` : "@handle"
                  }`}
                >
                  <div className="flex h-10 max-w-80 items-center rounded-lg border border-[#E6E2D8] bg-[#F4F1EA] px-3 text-[14px] text-[#5C625E]">
                    <span className="mr-1 text-[#8A8F8B]">@</span>
                    {handle || "—"}
                  </div>
                  <Note tone="warn">
                    You can change your handle once every six months. After a
                    change, you will need to wait before changing it again.
                  </Note>
                  <div>
                    <Button onClick={() => navigate("/profile/edit")}>
                      Change handle
                    </Button>
                  </div>
                </Row>
              </Card>
            </>
          )}

          {section === "reading" && (
            <>
              <PageHeading
                title="Reading preferences"
                lead="Tune your feed and how posts look. These follow you across devices."
              />
              <Card title="Favourite topics">
                <Row
                  stacked
                  description="We use these to shape your “For you” feed. Pick as many as you like."
                >
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((g) => {
                      const on = draft.genres.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleGenre(g)}
                          className={`inline-flex h-8 items-center rounded-full px-3.5 text-[13px] transition-colors ${
                            on
                              ? "bg-[#1F3D2F] text-white"
                              : "bg-[#EAE6DD] text-[#1B1F1C] hover:bg-[#DFDBD2]"
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </Row>
              </Card>
              <Card title="Feed">
                <Row
                  title="Default feed tab"
                  description="The tab you land on when you open Quill."
                >
                  <Segmented<FeedTab>
                    label="Default feed tab"
                    value={draft.defaultTab}
                    onChange={(v) => update("defaultTab", v)}
                    options={[
                      { value: "for-you", label: "For you" },
                      { value: "following", label: "Following" },
                    ]}
                  />
                </Row>
              </Card>
              <Card title="Reading appearance">
                <Row
                  title="Text size"
                  description="Applies to the body of posts."
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] text-[#5C625E]">A</span>
                    <input
                      type="range"
                      min={TEXT_SIZE_RANGE.min}
                      max={TEXT_SIZE_RANGE.max}
                      step={1}
                      value={draft.textSize}
                      aria-label="Text size"
                      onChange={(e) =>
                        update("textSize", Number(e.target.value))
                      }
                      className="w-48 accent-[#1F3D2F]"
                    />
                    <span className="text-[20px] text-[#5C625E]">A</span>
                  </div>
                </Row>
                <Row
                  title="Theme"
                  description="Changes the background and text colors of stories."
                >
                  <Segmented<ReadingTheme>
                    label="Theme"
                    value={draft.theme}
                    onChange={(v) => update("theme", v)}
                    options={[
                      { value: "light", label: "Light" },
                      { value: "sepia", label: "Sepia" },
                      { value: "dark", label: "Dark" },
                    ]}
                  />
                </Row>
                <Row stacked title="Preview">
                  <div
                    className="rounded-lg border border-[#E6E2D8] px-5 py-4"
                    style={{
                      background: previewColors[0],
                      color: previewColors[1],
                      fontSize: draft.textSize,
                    }}
                  >
                    <h4 className="font-editorial mb-1.5 text-[1.3em] leading-tight">
                      The quiet art of slow reading
                    </h4>
                    <p className="font-editorial leading-relaxed">
                      Good essays reward patience. Settle in, let the paragraphs
                      breathe, and notice how a well-chosen sentence changes the
                      pace of your afternoon.
                    </p>
                  </div>
                </Row>
              </Card>
            </>
          )}

          {section === "notifications" && (
            <>
              <PageHeading
                title="Notifications"
                lead="Choose what Quill tells you about."
              />
              <div className="mb-5">
                <Note tone="info">
                  In-app alerts are delivered in Quill. Email alerts require the
                  background worker; weekly digests are sent on Mondays at 09:00
                  UTC. Product updates are unavailable until a newsletter launches.
                </Note>
              </div>
              {(["In the app", "By email"] as const).map((title, i) => (
                <Card key={title} title={title}>
                  {notificationRows[i]?.map((r) => (
                    <Row
                      key={r.key}
                      title={r.title}
                      description={r.description}
                    >
                      <Switch
                        label={`${title}: ${r.title}`}
                        checked={draft.notifications[r.key]}
                        onChange={(on) => setNotification(r.key, on)}
                        disabled={r.key === "emailNews"}
                      />
                    </Row>
                  ))}
                </Card>
              ))}
            </>
          )}

          {section === "privacy" && (
            <>
              <PageHeading
                title="Privacy and security"
                lead="Keep your account safe and decide who can interact with you."
              />
              <Card title="Sessions">
                <Row
                  title={
                    <>
                      This device <Badge tone="ok">Current</Badge>
                    </>
                  }
                  description="Signed in today"
                />
                <Row
                  title="Sign out everywhere"
                  description="Ends your session on every device, including this one. You will sign in again with an email code."
                >
                  <Button
                    variant="outlineDanger"
                    disabled={isAuthWorking}
                    onClick={() => void handleSignOutEverywhere()}
                  >
                    Sign out everywhere
                  </Button>
                </Row>
                <Row
                  title={
                    <>
                      Manage individual devices <Badge>Soon</Badge>
                    </>
                  }
                  description="See each signed-in device and end sessions one at a time."
                >
                  <Button disabled>View devices</Button>
                </Row>
              </Card>
              <Card title="Privacy">
                <Row
                  title={
                    <>
                      Private account <Badge>Soon</Badge>
                    </>
                  }
                  description="Only approved followers can see your posts."
                >
                  <Switch label="Private account" checked={false} disabled />
                </Row>
                <Row
                  title={
                    <>
                      Blocked writers <Badge>Soon</Badge>
                    </>
                  }
                  description="Blocked people cannot follow you or see your activity."
                >
                  <Button disabled>Manage list</Button>
                </Row>
              </Card>
              <Card title="Staying safe with email sign-in">
                <ul className="list-disc space-y-1 py-3 pr-5 pl-9 text-[13px] text-[#5C625E]">
                  <li>
                    Never share your one-time code. Quill will never ask for it.
                  </li>
                  <li>
                    Keep your email account secure with a strong password and
                    two-step verification.
                  </li>
                  <li>
                    Use Sign out everywhere if you lose a device or share one.
                  </li>
                </ul>
              </Card>
            </>
          )}

          {section === "data" && (
            <>
              <PageHeading
                title="Data and account actions"
                lead="Take your writing with you, or leave Quill entirely."
              />
              <Card>
                <Row
                  title={
                    <>
                      Export your data <Badge>Soon</Badge>
                    </>
                  }
                  description="Download your posts, drafts, bookmarks and profile as a single file. We will email you a link when it is ready."
                >
                  <Button disabled>Request export</Button>
                </Row>
              </Card>
              <Card title="Delete account" danger>
                <Row
                  stacked
                  description="Deleting your account is permanent. Before you continue, here is what happens:"
                >
                  <ul className="list-disc space-y-1 pl-5 text-[14px] text-[#1B1F1C]">
                    <li>Your profile, drafts and bookmarks are removed.</li>
                    <li>Your followers and following lists are cleared.</li>
                    <li>Published posts are deleted with your account.</li>
                  </ul>
                  <div>
                    <Button
                      variant="danger"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete my account
                    </Button>
                  </div>
                </Row>
              </Card>
            </>
          )}
        </div>
      </main>

      {/* Unsaved changes bar */}
      <div
        role="status"
        aria-hidden={!dirty}
        className={`fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100%-24px)] items-center gap-3 rounded-full bg-[#1B1F1C] py-2 pr-2 pl-5 text-[13px] text-white shadow-xl transition-transform duration-200 ${
          dirty ? "-translate-x-1/2" : "translate-y-24 -translate-x-1/2"
        }`}
      >
        <span>You have unsaved changes</span>
        <button
          type="button"
          tabIndex={dirty ? 0 : -1}
          onClick={() => setDraft(saved)}
          className="h-8 rounded-full px-3.5 font-medium text-white/85 hover:bg-white/10"
        >
          Discard
        </button>
        <button
          type="button"
          tabIndex={dirty ? 0 : -1}
          disabled={isSaving}
          onClick={() => void handleSave()}
          className="h-8 rounded-full bg-white px-4 font-medium text-[#1F3D2F] hover:bg-[#F4F1EA] disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {confirmDelete && (
        <DeleteAccountDialog
          handle={handle}
          busy={isDeleting || isAuthWorking}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void handleDeleteAccount()}
        />
      )}
    </AppShell>
  );
};

export default SettingsPage;

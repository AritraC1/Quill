import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Crown,
  Link2,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../../../components/layout/AppShell";
import EmptyState from "../../profile/components/EmptyState";
import { formatRelativeTime } from "../../../lib/datetime";
import { getInitials } from "../../../lib/initials";
import { assetUrl } from "../../auth/api/auth.api";
import type {
  ClubApplicationDTO,
  ClubDTO,
  ClubInvitationDTO,
  ClubMemberDTO,
  ClubSubmissionDTO,
} from "@quill/shared";
import {
  acceptClubInvitationApi,
  applyToClubApi,
  createClubApi,
  decideClubApplicationApi,
  declineClubInvitationApi,
  listClubApplicationsApi,
  listClubInvitationsApi,
  listClubMembersApi,
  listClubSubmissionsApi,
  listDiscoverClubsApi,
  listMyClubsApi,
  reviewClubSubmissionApi,
  updateClubApi,
  updateClubMemberRoleApi,
} from "../api/club.api";

/* ---------- view types (mapped from the shared DTOs via the API) ---------- */
type Role = "admin" | "moderator" | "member";
type Privacy = "open" | "invite";

interface Club {
  id: string;
  name: string;
  description: string;
  privacy: Privacy;
  rules: string[];
  role: Role | null; // null = not a member (Discover)
  members: number;
  pendingReviews: number;
  color: string;
}
interface Submission { id: string; title: string; excerpt: string; author: string; words: number }
interface JoinRequest {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  note: string;
}

const PersonAvatar = ({ name, avatar }: { name: string; avatar?: string | null }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const src = assetUrl(avatar);

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={`${name}'s profile`}
        onError={() => setImageFailed(true)}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full bg-[#5C6B4F] font-editorial text-white">
      {getInitials(name) || "?"}
    </div>
  );
};

// The schema has no brand color — derive a stable one per club id
const CLUB_COLORS = ["#1F3D2F", "#B27D56", "#5C6B4F", "#7A4E3A", "#3B5248"];
const clubColor = (id: string) =>
  CLUB_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % CLUB_COLORS.length];

const fromClubDTO = (club: ClubDTO): Club => ({
  id: club.id,
  name: club.name,
  description: club.description,
  privacy: club.privacy,
  rules: club.rules,
  role: club.role,
  members: club.memberCount,
  pendingReviews: club.pendingReviews,
  color: clubColor(club.id),
});

const toSubmission = (s: ClubSubmissionDTO): Submission => ({
  id: s.id,
  title: s.title,
  excerpt: s.description,
  author: s.author.name,
  words: s.words,
});

const toRequest = (r: ClubApplicationDTO): JoinRequest => ({
  id: r.id,
  name: r.user.name,
  handle: r.user.handle,
  avatar: r.user.avatar,
  note: r.note,
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

const ROLE_STYLE: Record<Role, string> = {
  admin: "bg-[#1F3D2F] text-white",
  moderator: "bg-[#F0EDE4] text-[#1F3D2F] border border-[#D9D4C5]",
  member: "bg-transparent text-[#5C625E] border border-[#E6E2D6]",
};
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", moderator: "Moderator", member: "Member" };

/* ---------- small shared pieces ---------- */
const RoleBadge = ({ role }: { role: Role }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] ${ROLE_STYLE[role]}`}>
    {role === "admin" && <Crown className="w-3 h-3" />}
    {role === "moderator" && <ShieldCheck className="w-3 h-3" />}
    {ROLE_LABEL[role]}
  </span>
);

const ClubMark = ({ club, size = 44 }: { club: Club; size?: number }) => (
  <div
    className="shrink-0 rounded-xl font-editorial text-white flex items-center justify-center select-none"
    style={{ background: club.color, width: size, height: size, fontSize: size * 0.45 }}
  >
    {club.name[0]}
  </div>
);

const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1F3D2F] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2A5240] transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F3D2F]";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[#D9D4C5] px-4 py-2 text-[13px] text-[#1B1F1C] hover:bg-[#F0EDE4] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F3D2F]";
const inputCls =
  "w-full rounded-lg border border-[#D9D4C5] bg-white px-3 py-2 text-[14px] text-[#1B1F1C] placeholder:text-[#8A8F8B] focus:outline-2 focus:outline-[#1F3D2F]";

const Tabs = <T extends string>({ value, onChange, items }: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; count?: number }[];
}) => (
  <div role="tablist" className="flex gap-6 border-b border-[#E6E2D6] overflow-x-auto">
    {items.map((t) => (
      <button
        key={t.id}
        role="tab"
        aria-selected={value === t.id}
        onClick={() => onChange(t.id)}
        className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[14px] transition-colors ${
          value === t.id ? "border-[#1F3D2F] text-[#1B1F1C] font-medium" : "border-transparent text-[#8A8F8B] hover:text-[#1B1F1C]"
        }`}
      >
        {t.label}
        {t.count ? <span className="ml-1.5 rounded-full bg-[#B27D56] px-1.5 text-[11px] text-white">{t.count}</span> : null}
      </button>
    ))}
  </div>
);

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1B1F1C]/40 p-0 sm:p-4" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#FBFAF6] p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-editorial text-[24px] text-[#1B1F1C]">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="p-2 rounded-full text-[#8A8F8B] hover:bg-[#F0EDE4]">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="mt-5 block">
    <span className="text-[13px] font-medium text-[#1B1F1C]">{label}</span>
    {hint && <span className="ml-2 text-[12px] text-[#8A8F8B]">{hint}</span>}
    <div className="mt-1.5">{children}</div>
  </label>
);

/* ---------- create club ---------- */
const CreateClubModal = ({ onClose, onCreate, onCreateError }: {
  onClose: () => void;
  onCreate: (c: ClubDTO) => void;
  onCreateError: (message: string) => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("open");
  const [rules, setRules] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const addInvite = () => {
    const h = draft.trim().replace(/^@/, "");
    if (h && !invites.includes(h)) setInvites([...invites, h]);
    setDraft("");
  };

  const submit = async () => {
    if (!name.trim() || !description.trim() || saving) return;
    setSaving(true);
    try {
      const club = await createClubApi({
        name: name.trim(),
        description: description.trim(),
        privacy,
        rules: rules.split("\n").map((r) => r.trim()).filter(Boolean),
        inviteHandles: invites,
      });
      onCreate(club);
      toast(invites.length ? `Club created · ${invites.length} invite(s) sent` : "Club created");
      onClose();
    } catch (e) {
      onCreateError(errorMessage(e));
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Start a club" onClose={onClose}>
      <p className="mt-1 text-[14px] text-[#5C625E]">You'll be the admin. You can promote members to moderators later.</p>

      <Field label="Club name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slow Mornings" maxLength={40} />
      </Field>
      <Field label="What is it about?">
        <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One or two sentences for people deciding whether to join." />
      </Field>

      <Field label="Who can join?">
        <div className="grid grid-cols-2 gap-2">
          {([
            ["open", "Open to applications", "Anyone can apply. You or a moderator approves."],
            ["invite", "Invite only", "Hidden from Discover. Members join by invite."],
          ] as const).map(([id, t, d]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPrivacy(id)}
              className={`rounded-xl border p-3 text-left transition-colors ${privacy === id ? "border-[#1F3D2F] bg-[#F0EDE4]" : "border-[#D9D4C5] hover:bg-[#F6F3EA]"}`}
            >
              <p className="text-[13px] font-medium text-[#1B1F1C]">{t}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[#5C625E]">{d}</p>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Review rules" hint="One per line. Moderators check every blog against these.">
        <textarea className={inputCls} rows={4} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={"Original work only\nNo promotional links\nMinimum 800 words"} />
      </Field>

      <Field label="Invite people" hint="Optional. Add a handle and press Enter.">
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
            placeholder="@handle"
          />
          <button type="button" onClick={addInvite} className={btnGhost}>Add</button>
        </div>
        {invites.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {invites.map((h) => (
              <span key={h} className="inline-flex items-center gap-1 rounded-full bg-[#F0EDE4] px-2.5 py-1 text-[12px] text-[#1B1F1C]">
                @{h}
                <button type="button" aria-label={`Remove ${h}`} onClick={() => setInvites(invites.filter((i) => i !== h))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </Field>

      <div className="mt-7 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={() => { void submit(); }} disabled={!name.trim() || !description.trim() || saving} className={btnPrimary}>Create club</button>
      </div>
    </Modal>
  );
};

/* ---------- edit club details (admin, PATCH /clubs/:id) ---------- */
const EditClubModal = ({ club, onClose, onSave }: {
  club: Club;
  onClose: () => void;
  onSave: (
    patch: { name: string; description: string; privacy: Privacy },
  ) => Promise<void>;
}) => {
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description);
  const [privacy, setPrivacy] = useState<Privacy>(club.privacy);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !description.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), privacy });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit club details" onClose={onClose}>
      <Field label="Club name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slow Mornings" maxLength={60} />
      </Field>
      <Field label="What is it about?">
        <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One or two sentences for people deciding whether to join." maxLength={1000} />
      </Field>

      <Field label="Who can join?" hint="Rules stay in the Rules tab.">
        <div className="grid grid-cols-2 gap-2">
          {([
            ["open", "Open to applications", "Anyone can apply. You or a moderator approves."],
            ["invite", "Invite only", "Hidden from Discover. Members join by invite."],
          ] as const).map(([id, t, d]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPrivacy(id)}
              className={`rounded-xl border p-3 text-left transition-colors ${privacy === id ? "border-[#1F3D2F] bg-[#F0EDE4]" : "border-[#D9D4C5] hover:bg-[#F6F3EA]"}`}
            >
              <p className="text-[13px] font-medium text-[#1B1F1C]">{t}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[#5C625E]">{d}</p>
            </button>
          ))}
        </div>
      </Field>

      <div className="mt-7 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={() => { void submit(); }} disabled={!name.trim() || !description.trim() || saving} className={btnPrimary}>Save changes</button>
      </div>
    </Modal>
  );
};

/* ---------- club cards ---------- */
const ClubCard = ({ club, onOpen, onApply }: { club: Club; onOpen: () => void; onApply: () => void }) => (
  <div className="flex flex-col rounded-2xl border border-[#E6E2D6] bg-white p-5">
    <div className="flex items-start gap-3">
      <ClubMark club={club} />
      <div className="min-w-0 flex-1">
        <h3 className="font-editorial text-[20px] leading-tight text-[#1B1F1C] truncate">{club.name}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[#8A8F8B]">
          <Users className="w-3.5 h-3.5" /> {club.members} members
          {club.privacy === "invite" && <span>· Invite only</span>}
        </p>
      </div>
      {club.role && <RoleBadge role={club.role} />}
    </div>
    <p className="mt-3 flex-1 text-[14px] leading-6 text-[#5C625E]">{club.description}</p>
    <div className="mt-4 flex items-center justify-between">
      {club.role ? (
        <>
          <span className="text-[12px] text-[#8A8F8B]">
            {club.role !== "member" && club.pendingReviews > 0 ? (
              <span className="text-[#B27D56] font-medium">{club.pendingReviews} blogs to review</span>
            ) : club.role !== "member" ? "Review queue is clear" : ""}
          </span>
          <button onClick={onOpen} className={btnGhost}>Open</button>
        </>
      ) : (
        <>
          <span className="text-[12px] text-[#8A8F8B]">{club.rules.length} rules</span>
          <button onClick={onApply} className={btnPrimary}>Apply to join</button>
        </>
      )}
    </div>
  </div>
);

/* ---------- club detail ---------- */
type DetailTab = "review" | "members" | "requests" | "rules";

const ReviewCard = ({ sub, rules, onDecide }: {
  sub: Submission;
  rules: string[];
  onDecide: (d: "approve" | "changes" | "reject", note: string) => Promise<void>;
}) => {
  const [checked, setChecked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const allPass = checked.length === rules.length;

  const decide = (d: "approve" | "changes" | "reject") => {
    if (busy) return;
    setBusy(true);
    onDecide(d, note).catch(() => setBusy(false));
  };

  return (
    <article className="rounded-2xl border border-[#E6E2D6] bg-white p-5">
      <h3 className="font-editorial text-[22px] leading-snug text-[#1B1F1C]">{sub.title}</h3>
      <p className="mt-1 text-[12px] text-[#8A8F8B]">by {sub.author} · {sub.words.toLocaleString()} words</p>
      <p className="mt-3 text-[15px] leading-7 text-[#5C625E]">{sub.excerpt}</p>
      <a href={`/blog/${sub.id}`} className="mt-2 inline-block text-[13px] text-[#1F3D2F] hover:underline">Read the full blog</a>

      <fieldset className="mt-5 rounded-xl bg-[#F6F3EA] p-4">
        <legend className="px-1 text-[13px] font-medium text-[#1B1F1C]">
          Rules check · {checked.length}/{rules.length}
        </legend>
        {rules.map((r) => (
          <label key={r} className="mt-2 flex items-center gap-2.5 text-[14px] text-[#1B1F1C]">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[#1F3D2F]"
              checked={checked.includes(r)}
              onChange={() => setChecked(checked.includes(r) ? checked.filter((c) => c !== r) : [...checked, r])}
            />
            {r}
          </label>
        ))}
      </fieldset>

      <textarea
        className={`${inputCls} mt-4`}
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note to the author (needed to request changes or reject)"
        aria-label="Note to the author"
      />

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button onClick={() => decide("reject")} disabled={!note.trim() || busy} className={btnGhost}>Reject</button>
        <button onClick={() => decide("changes")} disabled={!note.trim() || busy} className={btnGhost}>Request changes</button>
        <button onClick={() => decide("approve")} disabled={!allPass || busy} className={btnPrimary}>Approve</button>
      </div>
    </article>
  );
};

const ClubDetail = ({ club, onBack, onLeaveRuleSaved, onUpdate }: {
  club: Club;
  onBack: () => void;
  onLeaveRuleSaved?: () => void;
  onUpdate?: (club: ClubDTO) => void;
}) => {
  const canModerate = club.role === "admin" || club.role === "moderator";
  const isAdmin = club.role === "admin";
  const [tab, setTab] = useState<DetailTab>(canModerate ? "review" : "members");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [members, setMembers] = useState<ClubMemberDTO[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [rules, setRules] = useState(club.rules.join("\n"));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [, setSavingDetails] = useState(false);


  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        const membersResult = await listClubMembersApi(club.id);
        if (!active) return;
        setMembers(membersResult.items);
        if (canModerate) {
          const [subsResult, requestsResult] = await Promise.all([
            listClubSubmissionsApi(club.id),
            listClubApplicationsApi(club.id),
          ]);
          if (!active) return;
          setSubs(subsResult.items.map(toSubmission));
          setRequests(requestsResult.items.map(toRequest));
        }
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [club.id, canModerate]);

  const reviewRules = rules.split("\n").filter(Boolean);

  const decideSubmission = async (
    sub: Submission,
    decision: "approve" | "changes" | "reject",
    note: string,
  ) => {
    try {
      await reviewClubSubmissionApi(club.id, sub.id, {
        decision:
          decision === "approve"
            ? "approved"
            : decision === "changes"
              ? "changes_requested"
              : "rejected",
        note: decision === "approve" ? note || undefined : note,
      });
      setSubs(subs.filter((x) => x.id !== sub.id));
      toast(
        decision === "approve"
          ? "Approved and published to the club"
          : decision === "changes"
            ? "Sent back with your notes"
            : "Rejected",
      );
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };

  const decideRequest = async (r: JoinRequest, decision: "approved" | "rejected") => {
    try {
      await decideClubApplicationApi(club.id, r.id, decision);
      setRequests(requests.filter((x) => x.id !== r.id));
      setMembers((m) => [...m, {
        id: r.id, name: r.name, handle: r.handle, avatar: r.avatar,
        role: "member", joinedAt: new Date().toISOString(),
      }]);
      toast(decision === "approved" ? `${r.name} joined the club` : "Request declined");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const changeRole = async (m: ClubMemberDTO, role: Role) => {
    try {
      await updateClubMemberRoleApi(club.id, m.id, role);
      setMembers(members.map((x) => (x.id === m.id ? { ...x, role } : x)));
      toast(`${m.name} is now a ${ROLE_LABEL[role].toLowerCase()}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const saveRules = async () => {
    try {
      const updated = await updateClubApi(club.id, {
        rules: rules.split("\n").map((r) => r.trim()).filter(Boolean),
      });
      setRules(updated.rules.join("\n"));
      onLeaveRuleSaved?.();
      toast("Rules saved");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const saveClubDetails = async (
    patch: { name: string; description: string; privacy: Privacy },
  ) => {
    setSavingDetails(true);
    try {
      const updated = await updateClubApi(club.id, patch);
      onUpdate?.(updated);
      toast("Club details saved");
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    } finally {
      setSavingDetails(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/clubs/${club.id}`);
      toast("Invite link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const tabs = [
    ...(canModerate ? [{ id: "review" as const, label: "Review queue", count: subs.length }] : []),
    { id: "members" as const, label: "Members" },
    ...(canModerate ? [{ id: "requests" as const, label: "Join requests", count: requests.length }] : []),
    { id: "rules" as const, label: "Rules" },
  ];

  return (
    <>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-[#5C625E] hover:text-[#1F3D2F] transition-colors">
        <ArrowLeft className="w-4 h-4" /> My clubs
      </button>

      <header className="mt-6 flex flex-wrap items-start gap-4">
        <ClubMark club={club} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-editorial text-[32px] sm:text-[40px] leading-[1.15] tracking-tight text-[#1B1F1C]">{club.name}</h1>
          <p className="mt-1.5 max-w-xl text-[15px] leading-6 text-[#5C625E]">{club.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {club.role && <RoleBadge role={club.role} />}
            <span className="text-[13px] text-[#8A8F8B]">
              {club.members} members
              {club.privacy === "invite" && <> · Invite only</>}
            </span>
            {/* the club's public blog page */}
            <Link to={`/clubs/${club.id}`} className="text-[13px] text-[#1F3D2F] hover:underline">Blogs</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {club.role && (
            <Link
              to={`/clubs/${club.id}/chat`}
              className={btnGhost}
              aria-label="Open the club chat hall"
            >
              <MessageCircle className="h-4 w-4" /> Chat hall
            </Link>
          )}
          {isAdmin && (
            <button
              onClick={() => setEditing(true)}
              className={btnGhost}
              aria-label="Edit club details"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
          {canModerate && (
            <button onClick={copyInvite} className={btnGhost}><Link2 className="w-4 h-4" /> Copy invite link</button>
          )}
        </div>
      </header>

      <div className="mt-8"><Tabs value={tab} onChange={setTab} items={tabs} /></div>

      <section className="mt-6">
        {tab === "review" && (
          subs.length === 0 ? (
            <EmptyState title={loading ? "Loading…" : "Nothing to review"} body="New submissions from members will show up here." ctaLabel="Back to clubs" ctaTo="/my-clubs" />
          ) : (
            <div className="space-y-4">
              {subs.map((s) => (
                <ReviewCard
                  key={s.id}
                  sub={s}
                  rules={reviewRules}
                  onDecide={(d, note) => decideSubmission(s, d, note)}
                />
              ))}
            </div>
          )
        )}

        {tab === "members" && (
          <ul className="divide-y divide-[#E6E2D6] rounded-2xl border border-[#E6E2D6] bg-white">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-[#B27D56] text-white font-editorial flex items-center justify-center select-none">{m.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[#1B1F1C] truncate">{m.name}</p>
                  <p className="text-[12px] text-[#8A8F8B]">@{m.handle}</p>
                </div>
                {isAdmin && m.role !== "admin" ? (
                  <select
                    aria-label={`Role for ${m.name}`}
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as Role)}
                    className="rounded-full border border-[#D9D4C5] bg-white px-3 py-1.5 text-[13px] text-[#1B1F1C]"
                  >
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
              </li>
            ))}
          </ul>
        )}

        {tab === "requests" && (
          requests.length === 0 ? (
            <EmptyState title={loading ? "Loading…" : "No pending requests"} body="People who apply to join will appear here." ctaLabel="Back to clubs" ctaTo="/my-clubs" />
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-2xl border border-[#E6E2D6] bg-white p-4">
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={r.name} avatar={r.avatar} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1B1F1C]">{r.name}</p>
                      {r.handle && <p className="text-[12px] text-[#8A8F8B]">@{r.handle}</p>}
                    </div>
                    <button onClick={() => decideRequest(r, "rejected")} className={btnGhost}>Decline</button>
                    <button onClick={() => decideRequest(r, "approved")} className={btnPrimary}><Check className="w-3.5 h-3.5" /> Accept</button>
                  </div>
                  <p className="mt-3 text-[14px] leading-6 text-[#5C625E]">{r.note}</p>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "rules" && (
          <div className="rounded-2xl border border-[#E6E2D6] bg-white p-5">
            <p className="text-[14px] text-[#5C625E]">Moderators check every submission against these.</p>
            {isAdmin ? (
              <>
                <textarea className={`${inputCls} mt-3`} rows={6} value={rules} onChange={(e) => setRules(e.target.value)} aria-label="Club rules, one per line" />
                <div className="mt-3 flex justify-end"><button onClick={() => { void saveRules(); }} className={btnPrimary}>Save rules</button></div>
              </>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-6 text-[#1B1F1C]">
                {reviewRules.map((r) => <li key={r}>{r}</li>)}
              </ol>
            )}
          </div>
        )}
      </section>

      {editing && (
        <EditClubModal
          club={club}
          onClose={() => setEditing(false)}
          onSave={saveClubDetails}
        />
      )}
    </>
  );
};

/* ---------- page ---------- */
type ListTab = "mine" | "discover" | "invites";

export const MyClubsPage = () => {
  const [mine, setMine] = useState<Club[]>([]);
  const [discover, setDiscover] = useState<Club[]>([]);
  const [invitations, setInvitations] = useState<ClubInvitationDTO[]>([]);
  const [tab, setTab] = useState<ListTab>("mine");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyTo, setApplyTo] = useState<Club | null>(null);
  const [applyNote, setApplyNote] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMine = async () => {
    try {
      const result = await listMyClubsApi({ limit: 50 });
      setMine(result.items.map(fromClubDTO));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const result = await listClubInvitationsApi({ limit: 50 });
      setInvitations(result.items);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const loadDiscover = async (search: string) => {
    try {
      const result = await listDiscoverClubsApi({ limit: 50, search: search || undefined });
      setDiscover(result.items.map(fromClubDTO));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  useEffect(() => {
    void loadMine();
    void loadInvitations();
  }, []);

  // Discover reloads with the (debounced) search term
  useEffect(() => {
    const timer = setTimeout(() => { void loadDiscover(query); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const openClub = mine.find((c) => c.id === openId);

  const respondInvitation = async (invitationId: string, action: "accept" | "decline") => {
    try {
      if (action === "accept") {
        await acceptClubInvitationApi(invitationId);
        toast("Invitation accepted");
      } else {
        await declineClubInvitationApi(invitationId);
        toast("Invitation declined");
      }
      setInvitations(invitations.filter((i) => i.id !== invitationId));
      void loadMine();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const sendApplication = async () => {
    if (!applyTo) return;
    try {
      await applyToClubApi(applyTo.id, applyNote.trim());
      toast(`Application sent to ${applyTo.name}`);
      setApplyTo(null);
      setApplyNote("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 md:py-10">
        {openClub ? (
          <ClubDetail
            club={openClub}
            onBack={() => setOpenId(null)}
            onUpdate={(updated) => {
              // Re-map via fromClubDTO so the name/description/privacy edits
              // flow straight into "Your clubs" and the open detail header
              setMine(mine.map((c) => (c.id === updated.id ? fromClubDTO(updated) : c)));
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-editorial text-[36px] sm:text-[44px] leading-[1.15] tracking-tight text-[#1B1F1C]">My clubs</h1>
                <p className="mt-2 max-w-md text-[15px] leading-6 text-[#5C625E]">Write alongside people who care about the same things, and keep the standard high together.</p>
              </div>
              <button onClick={() => setCreating(true)} className={btnPrimary}><Plus className="w-4 h-4" /> Start a club</button>
            </div>

            <div className="mt-8">
              <Tabs value={tab} onChange={setTab} items={[
                { id: "mine", label: "Your clubs", count: 0 },
                { id: "discover", label: "Discover" },
                { id: "invites", label: "Invitations", count: invitations.length },
              ]} />
            </div>

            <section className="mt-6">
              {tab === "mine" && (
                mine.length === 0 ? (
                  <EmptyState title={loading ? "Loading…" : "You're not in any clubs yet"} body="Start your own or apply to one from Discover." ctaLabel="Browse clubs" ctaTo="/my-clubs" />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {mine.map((c) => <ClubCard key={c.id} club={c} onOpen={() => setOpenId(c.id)} onApply={() => {}} />)}
                  </div>
                )
              )}

              {tab === "discover" && (
                <>
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8F8B]" />
                    <input className={`${inputCls} pl-9`} placeholder="Search clubs" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search clubs" />
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {discover.map((c) => <ClubCard key={c.id} club={c} onOpen={() => {}} onApply={() => setApplyTo(c)} />)}
                  </div>
                  {discover.length === 0 && <p className="mt-8 text-[14px] text-[#5C625E]">No open clubs match "{query}".</p>}
                </>
              )}

              {tab === "invites" && (
                invitations.length === 0 ? (
                  <p className="mt-2 text-[14px] text-[#5C625E]">No pending invitations right now.</p>
                ) : (
                  <ul className="space-y-3">
                    {invitations.map((inv) => (
                      <li key={inv.id} className="flex items-center gap-4 rounded-2xl border border-[#E6E2D6] bg-white p-5">
                        <div
                          className="shrink-0 rounded-xl font-editorial text-white flex items-center justify-center select-none"
                          style={{ background: clubColor(inv.club.id), width: 44, height: 44, fontSize: 20 }}
                        >
                          {inv.club.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] text-[#1B1F1C]"><span className="font-medium">{inv.inviter.name}</span> invited you to join <span className="font-medium">{inv.club.name}</span></p>
                          <p className="text-[12px] text-[#8A8F8B]">{formatRelativeTime(inv.createdAt)}</p>
                        </div>
                        <button onClick={() => respondInvitation(inv.id, "decline")} className={btnGhost}>Decline</button>
                        <button onClick={() => respondInvitation(inv.id, "accept")} className={btnPrimary}>Join</button>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
          </>
        )}
      </main>

      {creating && (
        <CreateClubModal
          onClose={() => setCreating(false)}
          onCreate={() => { void loadMine(); setTab("mine"); }}
          onCreateError={() => undefined}
        />
      )}

      {applyTo && (
        <Modal title={`Apply to ${applyTo.name}`} onClose={() => setApplyTo(null)}>
          <p className="mt-1 text-[14px] text-[#5C625E]">An admin or moderator will read this before accepting you.</p>
          <div className="mt-4 rounded-xl bg-[#F6F3EA] p-4">
            <p className="text-[13px] font-medium text-[#1B1F1C]">Club rules</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[14px] text-[#5C625E]">
              {applyTo.rules.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
          <Field label="Why do you want to join?">
            <textarea className={inputCls} rows={4} value={applyNote} onChange={(e) => setApplyNote(e.target.value)} placeholder="Tell them what you write and what you'd bring to the club." />
          </Field>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setApplyTo(null)} className={btnGhost}>Cancel</button>
            <button
              disabled={!applyNote.trim()}
              onClick={() => { void sendApplication(); }}
              className={btnPrimary}
            >
              Send application
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
};

export default MyClubsPage;

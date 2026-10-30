import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Crown,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../../../components/layout/AppShell";
import EmptyState from "../../profile/components/EmptyState";

/* ---------- types (move to @quill/shared once the API exists) ---------- */
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
interface Member { id: string; name: string; handle: string; role: Role }
interface Submission { id: string; title: string; excerpt: string; author: string; words: number }
interface JoinRequest { id: string; name: string; handle: string; note: string }

/* ---------- mock data ---------- */
const CLUBS: Club[] = [
  { id: "c1", name: "Slow Mornings", description: "Essays on routines, rest and the small rituals that hold a day together.", privacy: "open", rules: ["Original work only", "No promotional links", "800+ words", "Be kind in feedback"], role: "admin", members: 128, pendingReviews: 4, color: "#1F3D2F" },
  { id: "c2", name: "Field Notes", description: "Travel and nature writing from people who actually went there.", privacy: "invite", rules: ["First-person experience", "Photos must be yours"], role: "moderator", members: 46, pendingReviews: 2, color: "#B27D56" },
  { id: "c3", name: "Plain Code", description: "Programming posts without the jargon.", privacy: "open", rules: ["Code must run", "Explain every acronym"], role: "member", members: 312, pendingReviews: 0, color: "#5C6B4F" },
  { id: "c4", name: "Short Fiction Lab", description: "Weekly prompts, 1,500 words or fewer, honest critique.", privacy: "open", rules: ["Under 1,500 words", "Credit the prompt"], role: null, members: 89, pendingReviews: 0, color: "#7A4E3A" },
  { id: "c5", name: "Quiet Money", description: "Personal finance written calmly, with receipts.", privacy: "invite", rules: ["Cite your numbers"], role: null, members: 54, pendingReviews: 0, color: "#3B5248" },
];
const MEMBERS: Member[] = [
  { id: "m1", name: "You", handle: "you", role: "admin" },
  { id: "m2", name: "Aarav Mehta", handle: "aarav", role: "moderator" },
  { id: "m3", name: "Nisha Rao", handle: "nisha", role: "moderator" },
  { id: "m4", name: "Kabir Singh", handle: "kabir", role: "member" },
  { id: "m5", name: "Meera Iyer", handle: "meera", role: "member" },
];
const SUBMISSIONS: Submission[] = [
  { id: "s1", title: "The case for doing nothing before 9am", excerpt: "I used to reach for my phone before my feet touched the floor. Here is what changed when I stopped…", author: "Kabir Singh", words: 1240 },
  { id: "s2", title: "Ten tea rituals, ranked", excerpt: "Everyone has a kettle opinion. Mine started in a hostel kitchen in Pune…", author: "Meera Iyer", words: 620 },
];
const REQUESTS: JoinRequest[] = [
  { id: "r1", name: "Dev Patel", handle: "devp", note: "I write about slow living and would love feedback from this group." },
  { id: "r2", name: "Sana Khan", handle: "sanak", note: "Long-time reader, first time wanting to publish." },
];

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
const CreateClubModal = ({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Club) => void }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("open");
  const [rules, setRules] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const addInvite = () => {
    const h = draft.trim().replace(/^@/, "");
    if (h && !invites.includes(h)) setInvites([...invites, h]);
    setDraft("");
  };

  const submit = () => {
    onCreate({
      id: `c${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      privacy,
      rules: rules.split("\n").map((r) => r.trim()).filter(Boolean),
      role: "admin",
      members: 1,
      pendingReviews: 0,
      color: "#1F3D2F",
    });
    toast(invites.length ? `Club created · ${invites.length} invite(s) sent` : "Club created");
    onClose();
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
        <button onClick={submit} disabled={!name.trim() || !description.trim()} className={btnPrimary}>Create club</button>
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

const ClubDetail = ({ club, onBack }: { club: Club; onBack: () => void }) => {
  const canModerate = club.role === "admin" || club.role === "moderator";
  const isAdmin = club.role === "admin";
  const [tab, setTab] = useState<DetailTab>(canModerate ? "review" : "members");
  const [subs, setSubs] = useState(SUBMISSIONS);
  const [members, setMembers] = useState(MEMBERS);
  const [requests, setRequests] = useState(REQUESTS);
  const [rules, setRules] = useState(club.rules.join("\n"));

  const tabs = [
    ...(canModerate ? [{ id: "review" as const, label: "Review queue", count: subs.length }] : []),
    { id: "members" as const, label: "Members" },
    ...(canModerate ? [{ id: "requests" as const, label: "Join requests", count: requests.length }] : []),
    { id: "rules" as const, label: "Rules" },
  ];

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/clubs/${club.id}/join`);
      toast("Invite link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

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
          <div className="mt-3 flex items-center gap-3">
            {club.role && <RoleBadge role={club.role} />}
            <span className="text-[13px] text-[#8A8F8B]">{club.members} members</span>
          </div>
        </div>
        {canModerate && (
          <button onClick={copyInvite} className={btnGhost}><Link2 className="w-4 h-4" /> Copy invite link</button>
        )}
      </header>

      <div className="mt-8"><Tabs value={tab} onChange={setTab} items={tabs} /></div>

      <section className="mt-6">
        {tab === "review" && (
          subs.length === 0 ? (
            <EmptyState title="Nothing to review" body="New submissions from members will show up here." ctaLabel="Back to clubs" ctaTo="/clubs" />
          ) : (
            <div className="space-y-4">
              {subs.map((s) => (
                <ReviewCard
                  key={s.id}
                  sub={s}
                  rules={rules.split("\n").filter(Boolean)}
                  onDecide={(d) => {
                    setSubs(subs.filter((x) => x.id !== s.id));
                    toast(d === "approve" ? "Approved and published to the club" : d === "changes" ? "Sent back with your notes" : "Rejected");
                  }}
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
                    onChange={(e) => {
                      const role = e.target.value as Role;
                      setMembers(members.map((x) => (x.id === m.id ? { ...x, role } : x)));
                      toast(`${m.name} is now a ${ROLE_LABEL[role].toLowerCase()}`);
                    }}
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
            <EmptyState title="No pending requests" body="People who apply to join will appear here." ctaLabel="Back to clubs" ctaTo="/clubs" />
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-2xl border border-[#E6E2D6] bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#5C6B4F] text-white font-editorial flex items-center justify-center select-none">{r.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1B1F1C]">{r.name}</p>
                      <p className="text-[12px] text-[#8A8F8B]">@{r.handle}</p>
                    </div>
                    <button onClick={() => { setRequests(requests.filter((x) => x.id !== r.id)); toast("Request declined"); }} className={btnGhost}>Decline</button>
                    <button onClick={() => { setRequests(requests.filter((x) => x.id !== r.id)); toast(`${r.name} joined the club`); }} className={btnPrimary}><Check className="w-3.5 h-3.5" /> Accept</button>
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
                <div className="mt-3 flex justify-end"><button onClick={() => toast("Rules saved")} className={btnPrimary}>Save rules</button></div>
              </>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-6 text-[#1B1F1C]">
                {rules.split("\n").filter(Boolean).map((r) => <li key={r}>{r}</li>)}
              </ol>
            )}
          </div>
        )}
      </section>
    </>
  );
};

const ReviewCard = ({ sub, rules, onDecide }: {
  sub: Submission;
  rules: string[];
  onDecide: (d: "approve" | "changes" | "reject") => void;
}) => {
  const [checked, setChecked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const allPass = checked.length === rules.length;

  return (
    <article className="rounded-2xl border border-[#E6E2D6] bg-white p-5">
      <h3 className="font-editorial text-[22px] leading-snug text-[#1B1F1C]">{sub.title}</h3>
      <p className="mt-1 text-[12px] text-[#8A8F8B]">by {sub.author} · {sub.words.toLocaleString()} words</p>
      <p className="mt-3 text-[15px] leading-7 text-[#5C625E]">{sub.excerpt}</p>
      <button className="mt-2 text-[13px] text-[#1F3D2F] hover:underline">Read the full blog</button>

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
        <button onClick={() => onDecide("reject")} disabled={!note.trim()} className={btnGhost}>Reject</button>
        <button onClick={() => onDecide("changes")} disabled={!note.trim()} className={btnGhost}>Request changes</button>
        <button onClick={() => onDecide("approve")} disabled={!allPass} className={btnPrimary}>Approve</button>
      </div>
    </article>
  );
};

/* ---------- page ---------- */
type ListTab = "mine" | "discover" | "invites";

export const MyClubsPage = () => {
  const [clubs, setClubs] = useState(CLUBS);
  const [tab, setTab] = useState<ListTab>("mine");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyTo, setApplyTo] = useState<Club | null>(null);
  const [applyNote, setApplyNote] = useState("");

  const mine = useMemo(() => clubs.filter((c) => c.role), [clubs]);
  const discover = useMemo(
    () => clubs.filter((c) => !c.role && c.privacy === "open" && c.name.toLowerCase().includes(query.toLowerCase())),
    [clubs, query],
  );
  const openClub = clubs.find((c) => c.id === openId);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 md:py-10">
        {openClub ? (
          <ClubDetail club={openClub} onBack={() => setOpenId(null)} />
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
                { id: "invites", label: "Invitations", count: 1 },
              ]} />
            </div>

            <section className="mt-6">
              {tab === "mine" && (
                mine.length === 0 ? (
                  <EmptyState title="You're not in any clubs yet" body="Start your own or apply to one from Discover." ctaLabel="Browse clubs" ctaTo="/clubs" />
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
                <div className="flex items-center gap-4 rounded-2xl border border-[#E6E2D6] bg-white p-5">
                  <ClubMark club={clubs[4]} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] text-[#1B1F1C]"><span className="font-medium">Aarav Mehta</span> invited you to join <span className="font-medium">Quiet Money</span></p>
                    <p className="text-[12px] text-[#8A8F8B]">2 days ago</p>
                  </div>
                  <button onClick={() => toast("Invitation declined")} className={btnGhost}>Decline</button>
                  <button
                    onClick={() => {
                      setClubs(clubs.map((c) => (c.id === "c5" ? { ...c, role: "member" } : c)));
                      toast("You joined Quiet Money");
                      setTab("mine");
                    }}
                    className={btnPrimary}
                  >
                    Join
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {creating && (
        <CreateClubModal
          onClose={() => setCreating(false)}
          onCreate={(c) => { setClubs([c, ...clubs]); setTab("mine"); }}
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
              onClick={() => { toast(`Application sent to ${applyTo.name}`); setApplyTo(null); setApplyNote(""); }}
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
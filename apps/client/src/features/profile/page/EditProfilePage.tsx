import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useOwnProfile } from "../hooks/useOwnProfile";
import { editProfileApi } from "../api/profile.api";
import { AppShell } from "../../../components/layout/AppShell";
import { CURRENT_USER_HANDLE } from "../../../data/mockProfiles";

const MAX_BIO = 160;
const MAX_TOPICS = 5;
const TOPIC_OPTIONS = [
  "Philosophy", "Literature", "Productivity", "Essays", "Design",
  "Technology", "Culture", "Science", "Writing", "History",
];

// Same shape the system generates at first login ("julianvance328641")
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const HANDLE_LOCK_MONTHS = 6;

interface FormState {
  name: string;
  handle: string;
  bio: string;
  topics: string[];
  website: string;
  avatarUrl?: string;
}

const inputCls =
  "w-full h-10 rounded-lg border border-[#E6E2D8] bg-white px-3 text-[14px] text-[#1B1F1C] placeholder:text-[#8A8F8B] outline-none transition-colors focus:border-[#1F3D2F] focus:ring-1 focus:ring-[#1F3D2F]";

/* ---------- helpers ---------- */

// Center-crop to a square and shrink, so the stored image stays small
const toAvatar = (file: File, size = 256) =>
  new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unreadable image"));
    };
    img.src = url;
  });

const normalizeWebsite = (v: string) => {
  const t = v.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

const websiteError = (v: string) => {
  if (!v.trim()) return "";
  try {
    const u = new URL(normalizeWebsite(v));
    return u.hostname.includes(".") ? "" : "Enter a valid web address";
  } catch {
    return "Enter a valid web address";
  }
};

const Field = ({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) => (
  <div className="py-6 border-t border-[#E6E2D8]">
    <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[#1B1F1C] mb-2">
      {label}
    </label>
    {children}
    {error ? (
      <p role="alert" className="mt-2 text-[12px] text-[#ba1a1a]">{error}</p>
    ) : hint ? (
      <p className="mt-2 text-[12px] text-[#8A8F8B]">{hint}</p>
    ) : null}
  </div>
);

/* ---------- page ---------- */

export const EditProfilePage = () => {
  const navigate = useNavigate();
  const { profile, save } = useOwnProfile();

  const [initial] = useState<FormState>(() => ({
    name: profile.name,
    handle: profile.handle ?? CURRENT_USER_HANDLE,
    bio: profile.bio,
    topics: profile.topics,
    website: profile.website ?? "",
    avatarUrl: profile.avatarUrl,
  }));
  const [form, setForm] = useState<FormState>(initial);
  const [topicInput, setTopicInput] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const leaving = useRef(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Handle lock: unlocked right after onboarding, then 1 change per 6 months
  const handleLock = (() => {
    if (!profile.handleChangedAt) {
      return { locked: false, nextDate: null as Date | null };
    }
    const nextDate = new Date(profile.handleChangedAt);
    nextDate.setMonth(nextDate.getMonth() + HANDLE_LOCK_MONTHS);
    return {
      locked: new Date() < nextDate,
      nextDate,
    };
  })();

  const handleChanged = form.handle.trim().toLowerCase() !== initial.handle;
  const nameLen = form.name.trim().length;
  const errors = {
    name: nameLen < 2 ? "Enter at least 2 characters" : nameLen > 50 ? "Keep your name under 50 characters" : "",
    handle: !HANDLE_PATTERN.test(form.handle.trim().toLowerCase())
      ? "3–30 characters: lowercase letters, numbers, underscores and hyphens"
      : "",
    website: websiteError(form.website),
  };
  const valid = !errors.name && !errors.handle && !errors.website;

  // Warn on refresh or tab close with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (!file.type.startsWith("image/")) return setAvatarError("Choose an image file (JPG or PNG)");
    if (file.size > 5 * 1024 * 1024) return setAvatarError("Image must be under 5 MB");
    setAvatarBusy(true);
    setAvatarError("");
    try {
      set("avatarUrl", await toAvatar(file));
    } catch {
      setAvatarError("Couldn’t read that image. Try another one.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const addTopic = (raw: string) => {
    const t = raw.trim().replace(/\s+/g, " ");
    if (!t) return;
    const cap = t[0].toUpperCase() + t.slice(1);
    setForm((f) =>
      f.topics.length >= MAX_TOPICS || f.topics.some((x) => x.toLowerCase() === cap.toLowerCase())
        ? f
        : { ...f, topics: [...f.topics, cap] },
    );
    setTopicInput("");
  };

  const removeTopic = (t: string) => set("topics", form.topics.filter((x) => x !== t));

  const handleSave = async () => {
    setShowErrors(true);
    if (!valid) return;

    // Server is the source of truth — handle changes enforce the 6-month rule
    try {
      setIsSaving(true);
      await editProfileApi({
        avatar: form.avatarUrl ?? "", // empty clears the stored photo
        bio: form.bio.trim(),
        favGenre: form.topics,
        // only send the handle when it actually changed (server normalizes)
        handle: handleChanged ? form.handle.trim().toLowerCase() : undefined,
        website: normalizeWebsite(form.website) || undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Couldn't save your profile";
      toast.error(message);
      setIsSaving(false);
      return;
    }

    leaving.current = true;
    save({
      name: form.name.trim(),
      bio: form.bio.trim(),
      topics: form.topics,
      website: normalizeWebsite(form.website) || undefined,
      avatarUrl: form.avatarUrl,
    });
    navigate("/profile", { state: { toast: "Profile updated" } });
  };

  const handleCancel = () => {
    if (dirty && !window.confirm("Discard your changes?")) return;
    leaving.current = true;
    navigate("/profile");
  };

  const suggestions = TOPIC_OPTIONS.filter(
    (t) => !form.topics.some((x) => x.toLowerCase() === t.toLowerCase()),
  ).slice(0, 6);
  const atTopicLimit = form.topics.length >= MAX_TOPICS;

  return (
    <AppShell>
      <main className="mx-auto max-w-170 px-4 sm:px-6 py-6 md:py-8 pb-28 md:pb-12">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#5C625E] hover:text-[#1F3D2F] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to profile
        </Link>
        <h1 className="mt-4 mb-6 font-editorial text-[32px] sm:text-[36px] leading-tight text-[#1B1F1C] tracking-tight">
          Edit profile
        </h1>

        {/* Photo */}
        <div className="py-6 border-t border-[#E6E2D8]">
          <p className="text-[13px] font-medium text-[#1B1F1C] mb-3">Photo</p>
          <div className="flex items-center gap-5">
            {form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt="Your profile photo"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div
                className={`w-20 h-20 rounded-full ${profile.color} text-white font-editorial text-3xl flex items-center justify-center select-none`}
              >
                {(form.name.trim()[0] ?? "?").toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-4 text-[14px]">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarBusy}
                  className="text-[#1F3D2F] hover:underline disabled:opacity-50"
                >
                  {avatarBusy ? "Processing…" : form.avatarUrl ? "Update" : "Upload photo"}
                </button>
                {form.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => set("avatarUrl", undefined)}
                    className="text-[#8A8F8B] hover:text-[#ba1a1a]"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className={`mt-1.5 text-[12px] ${avatarError ? "text-[#ba1a1a]" : "text-[#8A8F8B]"}`} role={avatarError ? "alert" : undefined}>
                {avatarError || "JPG or PNG, up to 5 MB. Square images work best."}
              </p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          </div>
        </div>

        <Field label="Name" htmlFor="name" error={showErrors ? errors.name : ""}>
          <input
            id="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={60}
            autoComplete="name"
            aria-invalid={showErrors && Boolean(errors.name)}
            className={inputCls}
          />
        </Field>

        <Field
          label="Handle"
          htmlFor="handle"
          error={showErrors ? errors.handle : ""}
          hint={
            handleLock.locked ? (
              handleLock.nextDate && !handleChanged ? (
                <span>
                  Generated when you joined. Next change available{" "}
                  {handleLock.nextDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" "}— one change every 6 months.
                </span>
              ) : (
                "Your profile link: " + profile.handle
              )
            ) : (
              "Generated when you joined. You can change it once every 6 months."
            )
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#8A8F8B]">
              @
            </span>
            <input
              id="handle"
              value={form.handle}
              disabled={handleLock.locked}
              onChange={(e) =>
                set("handle", e.target.value.toLowerCase().replace(/\s+/g, ""))
              }
              maxLength={30}
              aria-invalid={showErrors && Boolean(errors.handle)}
              className={`${inputCls} pl-7 ${
                handleLock.locked
                  ? "bg-[#F0EDE4] text-[#5C625E] cursor-not-allowed"
                  : ""
              }`}
            />
          </div>
        </Field>

        <Field
          label="Bio"
          htmlFor="bio"
          hint={
            <span className="flex justify-between">
              <span>Shown on your profile and next to your stories.</span>
              <span className={form.bio.length >= MAX_BIO ? "text-[#ba1a1a]" : ""}>
                {form.bio.length}/{MAX_BIO}
              </span>
            </span>
          }
        >
          <textarea
            id="bio"
            rows={4}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value.slice(0, MAX_BIO))}
            className="w-full rounded-lg border border-[#E6E2D8] bg-white px-3 py-2.5 text-[14px] leading-6 text-[#1B1F1C] outline-none resize-none transition-colors focus:border-[#1F3D2F] focus:ring-1 focus:ring-[#1F3D2F]"
          />
        </Field>

        <Field
          label="Topics"
          htmlFor="topic-input"
          hint={`Add up to ${MAX_TOPICS}. Press Enter to add. ${form.topics.length}/${MAX_TOPICS} used.`}
        >
          <div className="flex flex-wrap gap-2 mb-3">
            {form.topics.map((t) => (
              <span
                key={t}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-[#EAE6DD] pl-3.5 pr-1.5 text-[13px] text-[#1B1F1C]"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTopic(t)}
                  aria-label={`Remove ${t}`}
                  className="grid h-5 w-5 place-items-center rounded-full text-[#5C625E] hover:bg-[#DFDBD2] hover:text-[#1B1F1C]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {form.topics.length === 0 && (
              <span className="text-[13px] text-[#8A8F8B]">No topics yet</span>
            )}
          </div>
          <input
            id="topic-input"
            value={topicInput}
            disabled={atTopicLimit}
            onChange={(e) => setTopicInput(e.target.value.replace(",", ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTopic(topicInput);
              } else if (e.key === "Backspace" && !topicInput && form.topics.length) {
                removeTopic(form.topics[form.topics.length - 1]);
              }
            }}
            maxLength={24}
            placeholder={atTopicLimit ? "Topic limit reached" : "Add a topic…"}
            className={`${inputCls} disabled:bg-[#F0EDE4] disabled:cursor-not-allowed`}
          />
          {!atTopicLimit && suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTopic(t)}
                  className="h-7 rounded-full border border-[#E6E2D8] px-3 text-[12px] text-[#5C625E] hover:border-[#1F3D2F] hover:text-[#1F3D2F] transition-colors"
                >
                  + {t}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Website" htmlFor="website" error={showErrors ? errors.website : ""} hint="Optional">
          <input
            id="website"
            type="text"
            inputMode="url"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="yourname.com"
            autoComplete="url"
            aria-invalid={showErrors && Boolean(errors.website)}
            className={inputCls}
          />
        </Field>

        {/* Actions */}
        <div className="pt-6 border-t border-[#E6E2D8] flex items-center justify-end gap-3">
          {dirty && <span className="mr-auto text-[13px] text-[#8A8F8B]">Unsaved changes</span>}
          <button
            type="button"
            onClick={handleCancel}
            className="h-9 rounded-full px-4 text-[13px] font-medium text-[#5C625E] hover:text-[#1B1F1C] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || avatarBusy || isSaving}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[#1F3D2F] px-5 text-[13px] font-medium text-white hover:bg-[#2A5240] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving || avatarBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </main>
    </AppShell>
  );
};

export default EditProfilePage;
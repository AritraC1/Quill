import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, Sparkles, ArrowRight, Loader2, BookOpen, PenTool } from "lucide-react";
import type { GenreOption } from "../types";

const GENRES: GenreOption[] = [
  { id: "essays", name: "Essays & Reflection", description: "Long-form personal narratives & thoughtful observations" },
  { id: "technology", name: "Technology & Future", description: "Computing, engineering, open source & digital crafts" },
  { id: "philosophy", name: "Philosophy & Mind", description: "Ethics, epistemology, mindfulness & human nature" },
  { id: "culture", name: "Culture & Society", description: "Art, architecture, cities, media & social trends" },
  { id: "literature", name: "Literature & Poetry", description: "Book reviews, prose analysis, poetry & craft of writing" },
  { id: "science", name: "Science & Nature", description: "Biology, astronomy, ecology & scientific wonders" },
  { id: "design", name: "Design & Craft", description: "Typography, product aesthetics, industrial design & minimalism" },
  { id: "productivity", name: "Work & Focus", description: "Deep work, craftsmanship, thinking tools & creative habits" },
];

export const OnboardingView = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleGenre = (genreId: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedGenres.length === 0) {
      setError("Please pick at least one favorite genre to customize your feed.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Persist onboarding profile data in client storage
      const onboardingData = {
        avatarUrl: avatarPreview,
        bio: bio.trim(),
        genres: selectedGenres,
        completedAt: new Date().toISOString(),
      };
      localStorage.setItem("quill_onboarding_profile", JSON.stringify(onboardingData));

      // Simulate a brief pleasant transition
      await new Promise((res) => setTimeout(res, 500));
      navigate("/feed");
    } catch {
      setError("Failed to save your preferences. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F3E9] text-[#232A3B] font-['Inter',ui-sans-serif,system-ui] py-12 px-4 sm:px-6 lg:px-8">
      {/* Paper texture overlay */}
      <div className="pointer-events-none fixed inset-0 grain" aria-hidden="true" />

      <div className="relative mx-auto max-w-2xl">
        {/* Brand header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="font-editorial text-3xl font-semibold tracking-tight">✍🏻 Quill</span>
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl text-[#232A3B] tracking-tight">
            Craft your quiet space
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#232A3B]/70">
            Tell us how you'd like to read and write. You can always refine this later.
          </p>
        </div>

        {/* Card Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#232A3B]/15 bg-white/80 backdrop-blur-sm p-6 sm:p-10 shadow-sm flex flex-col gap-8"
        >
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Section 1: Profile Image */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-[#232A3B]/10">
            <div className="relative group">
              <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-[#232A3B]/20 bg-[#F7F3E9] flex items-center justify-center shadow-inner">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PenTool className="h-8 w-8 text-[#232A3B]/40" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[#232A3B] text-[#F7F3E9] shadow-md hover:bg-[#3B6255] transition-colors"
                aria-label="Upload profile picture"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            <div className="text-center sm:text-left flex-1">
              <h3 className="font-medium text-[16px] text-[#232A3B]">Author Portrait</h3>
              <p className="text-xs sm:text-sm text-[#232A3B]/60 mt-1">
                Upload a photo or avatar that will appear beside your written pieces and notes.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs font-medium text-[#3B6255] underline underline-offset-2 hover:text-[#232A3B]"
              >
                {avatarPreview ? "Replace photo" : "Select an image"}
              </button>
            </div>
          </div>

          {/* Section 2: Short Bio */}
          <div className="flex flex-col gap-2 pb-6 border-b border-[#232A3B]/10">
            <div className="flex items-center justify-between">
              <label htmlFor="bio" className="text-sm font-medium text-[#232A3B]">
                Short Bio
              </label>
              <span className="text-xs text-[#232A3B]/50 font-mono">
                {bio.length}/160
              </span>
            </div>
            <textarea
              id="bio"
              rows={3}
              maxLength={160}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Essayist and systems architect exploring quiet software and slow typography."
              className="w-full resize-none rounded-xl border border-[#232A3B]/15 bg-[#F7F3E9]/40 p-3.5 text-sm text-[#232A3B] placeholder:text-[#232A3B]/40 focus:border-[#3B6255] focus:outline-none focus:ring-1 focus:ring-[#3B6255]"
            />
            <p className="text-xs text-[#232A3B]/60">
              A line or two introducing your perspectives to fellow readers.
            </p>
          </div>

          {/* Section 3: Favorite Blog Genres */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-[#232A3B] flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#3B6255]" />
                  Favorite Genres
                </h3>
                <p className="text-xs text-[#232A3B]/60 mt-0.5">
                  Select the realms of writing you wish to follow on your feed.
                </p>
              </div>
              <span className="text-xs text-[#3B6255] font-medium bg-[#3B6255]/10 px-2.5 py-1 rounded-full">
                {selectedGenres.length} selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {GENRES.map((genre) => {
                const isSelected = selectedGenres.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    className={`flex items-start gap-3 rounded-xl p-3.5 text-left border transition-all ${
                      isSelected
                        ? "border-[#3B6255] bg-[#3B6255]/5 ring-1 ring-[#3B6255]"
                        : "border-[#232A3B]/15 bg-white hover:border-[#232A3B]/30"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "border-[#3B6255] bg-[#3B6255] text-white"
                          : "border-[#232A3B]/30 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#232A3B]">
                        {genre.name}
                      </div>
                      <div className="text-xs text-[#232A3B]/60 mt-0.5 line-clamp-2 leading-relaxed">
                        {genre.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action / Submit */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-[#232A3B]/60 inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#3B6255]" />
              Tailoring your curated feed
            </span>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#232A3B] px-8 py-3.5 text-sm font-medium text-[#F7F3E9] shadow-sm hover:bg-[#3B6255] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entering Quill...
                </>
              ) : (
                <>
                  Enter Feed
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OnboardingView;

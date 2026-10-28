import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  MoreHorizontal,
  Bell,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Story } from "../../features/profile/types/story.types";

interface StoryCardProps {
  story: Story;
  layout?: "grid" | "list";
  onBookmarkToggle?: (storyId: string, newState: boolean) => void;
  /** Only wired for own blogs — opens the editor */
  onEdit?: (storyId: string) => void;
  /** Only wired for own blogs — fires after the confirm step */
  onDelete?: (storyId: string) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({
  story,
  onBookmarkToggle,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();
  const [bookmarked, setBookmarked] = useState(Boolean(story.isBookmarked));
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // close the menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextState = !bookmarked;
    setBookmarked(nextState);
    onBookmarkToggle?.(story.id, nextState);
  };

  // story cards route to the full blog page
  const open = () => navigate(`/blog/${story.id}`);

  const menuBtn =
    "w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#5C625E] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] transition-colors";

  const renderGraphicCover = () => {
    if (story.iconType === "letter" || story.id === "1" || story.id === "prof-1") {
      return (
        <div className="w-[124px] h-[86px] rounded-lg bg-[#3F5B4B] flex items-center justify-center shrink-0 shadow-sm">
          <span className="font-editorial text-4xl text-[#A8D5BA] font-light select-none">
            T
          </span>
        </div>
      );
    }
    if (story.iconType === "quill" || story.id === "2" || story.id === "prof-2") {
      return (
        <div className="w-[124px] h-[86px] rounded-lg bg-[#967046] flex items-center justify-center shrink-0 shadow-sm">
          {/* Stylized quill stroke icon */}
          <svg
            className="w-8 h-8 text-[#EAD9C2]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
            <line x1="16" y1="8" x2="2" y2="22" />
            <line x1="17.5" y1="15" x2="9" y2="15" />
          </svg>
        </div>
      );
    }
    if (story.iconType === "bell" || story.id === "3" || story.id === "prof-3") {
      return (
        <div className="w-[124px] h-[86px] rounded-lg bg-[#4E5B6E] flex items-center justify-center shrink-0 shadow-sm">
          <Bell className="w-8 h-8 text-[#D1D9E6] stroke-[1.5]" />
        </div>
      );
    }

    if (story.imageUrl) {
      return (
        <img
          src={story.imageUrl}
          alt={story.title}
          className="w-[124px] h-[86px] rounded-lg object-cover shrink-0"
        />
      );
    }

    return (
      <div className="w-[124px] h-[86px] rounded-lg bg-[#F0EDE4] flex items-center justify-center shrink-0">
        <span className="font-newsreader text-sm text-[#5C625E]">
          {story.topic}
        </span>
      </div>
    );
  };

  return (
    <article
      onClick={open}
      className="group relative py-7 border-b border-[#E6E2D8] last:border-b-0 cursor-pointer"
    >
      {/* Left Column: Title, Excerpt, Metadata Badges & Read info */}
      <div className="flex items-start justify-between gap-6 sm:gap-10">
        <div className="flex-1 min-w-0">
          <h2 className="font-editorial text-[20px] sm:text-[22px] font-bold text-[#1B1F1C] tracking-tight leading-[1.3] group-hover:text-[#1F3D2F] transition-colors">
            {story.title}
          </h2>

          <p className="mt-2 text-[14px] sm:text-[15px] leading-[22px] sm:leading-[24px] text-[#5C625E] line-clamp-2">
            {story.excerpt}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[12px] text-[#8A8F8B]">
            {/* Topic pill */}
            <span className="inline-flex items-center rounded-full bg-[#F0EDE4] px-3 py-1 text-[12px] text-[#1B1F1C]">
              {story.topic}
            </span>

            {/* Staff pick badge */}
            {story.isStaffPick && (
              <span className="inline-flex items-center rounded-full bg-[#1F3D2F]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#1F3D2F]">
                Best pick
              </span>
            )}

            <span>{story.readTime}</span>
            <span>{story.publishedDate}</span>

            {/* Bookmark & More action */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleBookmark}
                className="p-1 text-[#8A8F8B] hover:text-[#1B1F1C] transition-colors"
                title={bookmarked ? "Remove bookmark" : "Save story"}
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    bookmarked ? "fill-[#1F3D2F] text-[#1F3D2F]" : ""
                  }`}
                />
              </button>

              {/* 3-dots menu only on the viewer's own blogs */}
              {story.isMine && (
                <div
                  className="relative"
                  ref={menuRef}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen((v) => !v);
                    }}
                    className="p-1 text-[#8A8F8B] hover:text-[#1B1F1C] transition-colors"
                    title="More options"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-44 rounded-xl border border-[#E6E2D8] bg-white py-2 shadow-lg z-30 animate-fade-in"
                    >
                      {confirmDelete ? (
                        <>
                          <span className="block px-4 py-1.5 text-[12px] text-[#5C625E]">
                            Delete this blog?
                          </span>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(false);
                              onDelete?.(story.id);
                            }}
                            className={`${menuBtn} text-[#ba1a1a] font-medium`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(false);
                              setMenuOpen(false);
                            }}
                            className={menuBtn}
                          >
                            <span>Cancel</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(false);
                              onEdit?.(story.id);
                            }}
                            className={menuBtn}
                          >
                            <Pencil className="w-4 h-4" />
                            <span>Edit blog</span>
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(true);
                            }}
                            className={`${menuBtn} hover:text-[#ba1a1a]`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete blog</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Visual graphic badge/card */}
        <div className="shrink-0">{renderGraphicCover()}</div>
      </div>
    </article>
  );
};

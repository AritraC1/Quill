import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import type { Draft } from "../../../data/mockProfiles";

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
};

const DraftRow = ({
  draft,
  confirming,
  onAskDelete,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  confirming: boolean;
  onAskDelete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) => (
  <article className="py-6 border-b border-[#E6E2D8]">
    <Link to={`/write/${draft.id}`} className="block group">
      <h2 className="font-editorial text-[21px] leading-snug text-[#1B1F1C] group-hover:underline underline-offset-4 decoration-1">
        {draft.title || "Untitled draft"}
      </h2>
      <p className="mt-1.5 text-[15px] text-[#5C625E] line-clamp-2">
        {draft.excerpt}
      </p>
    </Link>
    <div className="mt-4 flex items-center gap-3 text-[13px] text-[#8A8F8B]">
      <span className="rounded-full bg-[#F0EDE4] px-2.5 py-0.5 text-[#5C625E]">
        Draft
      </span>
      <span>Edited {timeAgo(draft.updatedAt)}</span>
      <span>{draft.words} words</span>
      <div className="ml-auto flex items-center gap-3">
        {confirming ? (
          <>
            <span className="text-[#5C625E]">Delete this draft?</span>
            <button
              type="button"
              onClick={onDelete}
              className="font-medium text-[#ba1a1a] hover:underline"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="hover:text-[#1B1F1C]"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <Link
              to={`/write/${draft.id}`}
              className="text-[#1F3D2F] hover:underline"
            >
              Continue writing
            </Link>
            <button
              type="button"
              onClick={onAskDelete}
              aria-label="Delete draft"
              className="p-1.5 rounded-md hover:bg-[#F0EDE4] hover:text-[#ba1a1a] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  </article>
);

export default DraftRow;

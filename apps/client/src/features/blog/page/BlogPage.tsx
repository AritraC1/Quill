import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../../../components/layout/AppShell";
import EmptyState from "../../profile/components/EmptyState";
import { getBlogApi, bookmarkBlogApi } from "../api/blog.api";
import type { BlogResponseDTO } from "@quill/shared";
import {
  markdownToHtml,
  markdownToPlainText,
  wordCount,
  readTimeMinutes,
} from "../lib/markdown";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export const BlogPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [blog, setBlog] = useState<BlogResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getBlogApi(id)
      .then((loaded) => {
        if (cancelled) return;
        setBlog(loaded);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const back = () => navigate(-1);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/blog/${blog!.id}`,
      );
      toast("Blog link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const toggleBookmark = () => {
    if (!blog) return;
    const next = !blog.isBookmarked;
    // optimistic, revert on failure
    setBlog({ ...blog, isBookmarked: next });
    bookmarkBlogApi(blog.id, next)
      .then(() => toast(next ? "Saved to reading list" : "Removed from saved"))
      .catch(() => {
        setBlog({ ...blog, isBookmarked: !next });
        toast.error("Could not update bookmark");
      });
  };

  if (notFound) {
    return (
      <AppShell>
        <div className="mx-auto max-w-270 px-4 py-24 text-center">
          <EmptyState
            title="We couldn't find that story"
            body="It may have been deleted, or the link may be wrong."
            ctaLabel="Back to your feed"
            ctaTo="/feed"
          />
        </div>
      </AppShell>
    );
  }

  if (isLoading || !blog) {
    return (
      <AppShell>
        <div className="flex justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-[#1F3D2F]" />
        </div>
      </AppShell>
    );
  }

  const words = wordCount(markdownToPlainText(blog.content));

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 md:py-10">
        {/* Back button — returns to wherever the story was opened from */}
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#5C625E] hover:text-[#1F3D2F] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <article className="mt-8">
          <h1 className="font-editorial text-[36px] sm:text-[44px] leading-[1.15] text-[#1B1F1C] tracking-tight">
            {blog.title || "Untitled"}
          </h1>

          {/* Author row */}
          <div className="mt-5 flex items-center gap-3">
            {blog.author?.avatar ? (
              <img
                src={blog.author.avatar}
                alt={blog.author.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#B27D56] text-white font-editorial flex items-center justify-center select-none">
                {(blog.author?.name ?? "A")[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[#1B1F1C] truncate">
                {blog.author?.handle ? (
                  <Link
                    to={`/${blog.author.handle}`}
                    className="hover:underline hover:text-[#1F3D2F] transition-colors"
                  >
                    {blog.author.name ?? "Unknown author"}
                  </Link>
                ) : (
                  (blog.author?.name ?? "Unknown author")
                )}
              </p>
              <p className="text-[12px] text-[#8A8F8B]">
                {blog.publishedAt ? formatDate(blog.publishedAt) : "Draft"} ·{" "}
                {readTimeMinutes(words)} min read
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleBookmark}
                title={blog.isBookmarked ? "Remove bookmark" : "Save story"}
                className="p-2 rounded-full text-[#8A8F8B] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] transition-colors"
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    blog.isBookmarked ? "fill-[#1F3D2F] text-[#1F3D2F]" : ""
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => void copyLink()}
                title="Copy link"
                className="p-2 rounded-full text-[#8A8F8B] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rendered markdown content */}
          <div
            className="prose-preview mt-8 text-[17px] leading-8 text-[#1B1F1C]"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(blog.content) }}
          />
        </article>
      </main>
    </AppShell>
  );
};

export default BlogPage;

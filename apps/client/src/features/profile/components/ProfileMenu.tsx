import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Share2, Copy, Flag } from "lucide-react";
import { toast } from "sonner";

interface ProfileMenuProps {
  isOwn: boolean;
  name: string;
  /** The handle behind this profile — links always point to /u/<handle> */
  handle: string;
}

const ProfileMenu = ({ isOwn, name, handle }: ProfileMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Canonical shareable URL: <origin>/u/<handle> (e.g. http://localhost:5173/u/julianvance)
  const profileUrl = `${window.location.origin}/u/${handle}`;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast("Profile link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
    setOpen(false);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name} on Quill`,
          url: profileUrl,
        });
      } catch {
        /* user dismissed the share sheet */
      }
      setOpen(false);
    } else {
      void copy();
    }
  };

  const item =
    "w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#5C625E] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] transition-colors";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E2D8] bg-white text-[#5C625E] hover:border-[#8A8F8B] hover:text-[#1B1F1C] transition-colors"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 rounded-xl border border-[#E6E2D8] bg-white py-2 shadow-lg z-30 animate-fade-in"
        >
          <button type="button" role="menuitem" onClick={copy} className={item}>
            <Copy className="w-4 h-4 text-[#8A8F8B]" />
            <span>Copy link</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={share}
            className={item}
          >
            <Share2 className="w-4 h-4 text-[#8A8F8B]" />
            <span>Share profile</span>
          </button>
          {!isOwn && (
            <>
              <div className="my-1 border-t border-[#E6E2D8]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  toast("Thanks, we'll review this account");
                  setOpen(false);
                }}
                className={`${item} text-[#8A8F8B] hover:text-[#ba1a1a]`}
              >
                <Flag className="w-4 h-4" />
                <span>Report account</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;

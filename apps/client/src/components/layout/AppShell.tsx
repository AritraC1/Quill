import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { PenSquare, Search, Bookmark, Home, X } from "lucide-react";
import { useAuth } from "../../features/auth";
import { NotificationBell } from "../../features/notifications";
import { loadStoredUser } from "../../lib/user-store";
import { getInitials } from "../../lib/initials";
import { assetUrl } from "../../features/auth/api/auth.api";

interface AppShellProps {
  children: ReactNode;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const AppShell = ({
  children,
  searchQuery = "",
  onSearchChange,
}: AppShellProps) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search works on every page. Pages that own live filtering (the feed)
  // pass `onSearchChange`; everywhere else the query lives in the `?q=` URL
  // param (the profile page filters on it live), and Enter jumps to
  // `/feed?q=…` where the whole feed is searchable.
  const query = onSearchChange ? searchQuery : (searchParams.get("q") ?? "");
  const onQueryChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (val) next.set("q", val);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };
  const onQuerySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!onSearchChange && query.trim()) {
      navigate(`/feed?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Retrieve user onboarding / profile data + name captured at sign-up
  const userProfile = (() => {
    try {
      const saved = localStorage.getItem("quill_onboarding_profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const storedUser = loadStoredUser();
  const avatarInitial = getInitials(storedUser?.name) || "Q";

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen w-full bg-[#F6F3EC] text-[#1B1F1C] font-['Inter',sans-serif] selection:bg-[#1F3D2F]/15 selection:text-[#1F3D2F] flex flex-col">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#E6E2D8] bg-[#F6F3EC]/95 backdrop-blur-md">
        {/* Mobile: 3-column grid (search | centered logo | avatar). Desktop: flex row */}
        <div className="mx-auto grid h-16 max-w-270 grid-cols-[1fr_auto_1fr] items-center px-4 sm:flex sm:justify-between sm:px-6">
          {/* Left */}
          <div className="flex items-center gap-6 justify-self-start">
            {/* Mobile: search toggle */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="sm:hidden -ml-2 p-2 text-[#5C625E] hover:text-[#1B1F1C]"
              title="Search"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Desktop: logo */}
            <Link
              to="/feed"
              className="hidden sm:block font-newsreader text-[26px] font-semibold text-[#1F3D2F] tracking-tight hover:opacity-90 transition-opacity"
            >
              Quill
            </Link>

            {/* Desktop search */}
            <form
              onSubmit={onQuerySubmit}
              className="hidden sm:flex items-center gap-2 rounded-full border border-[#E6E2D8] bg-white px-3.5 py-1.5 text-[13px] text-[#1B1F1C] shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#1F3D2F] focus-within:ring-1 focus-within:ring-[#1F3D2F]"
            >
              <Search className="w-4 h-4 text-[#8A8F8B]" />
              <input
                type="search"
                placeholder="Search stories & authors..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="bg-transparent outline-none placeholder:text-[#8A8F8B] text-[13px] w-52 text-[#1B1F1C]"
              />
            </form>
          </div>

          {/* Center: mobile-only logo */}
          <Link
            to="/feed"
            className="sm:hidden justify-self-center font-newsreader text-[26px] font-semibold text-[#1F3D2F] tracking-tight hover:opacity-90 transition-opacity"
          >
            Quill
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-3 sm:gap-4 justify-self-end">
            {/* Write button (desktop only) */}
            <Link
              to="/write"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#A8D5BA] px-3.5 py-1.5 min-h-9 text-[14px] font-medium text-[#1B1F1C] hover:bg-[#97C7AA] transition-colors shadow-sm"
            >
              <PenSquare className="w-4 h-4 text-[#1B1F1C]" />
              <span>Write</span>
            </Link>

            {/* Notifications bell — unread badge, dropdown with mark-read/clear */}
            <NotificationBell />

            {/* Bookmarks icon — deep-links to the Saved tab on your profile */}
            <Link
              to="/profile?tab=saved"
              className="hidden sm:flex p-1.5 text-[#5C625E] hover:text-[#1B1F1C] transition-colors"
              title="Saved stories"
            >
              <Bookmark className="w-5 h-5 stroke-[1.6]" />
            </Link>

            {/* Avatar button with dropdown menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center justify-center rounded-full hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3D2F]"
                title="Account menu"
                aria-label="Account menu"
              >
                {userProfile?.avatarUrl ? (
                  <img
                    src={assetUrl(userProfile.avatarUrl)}
                    alt="User avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#B27D56] text-white font-newsreader text-base font-normal flex items-center justify-center shadow-inner">
                    {avatarInitial}
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#E6E2D8] bg-[#141815] text-[#E6E2D8] py-2 shadow-xl z-50 animate-fade-in">
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center px-4 py-2 text-[14px] text-[#E6E2D8] hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <span>Profile</span>
                  </Link>

                  {/* <div className="flex items-center px-4 py-2 text-[14px] text-[#E6E2D8] hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
                    <span>Analytics</span>
                  </div> */}

                  <Link
                    to="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center px-4 py-2 text-[14px] text-[#E6E2D8] hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <span>Settings</span>
                  </Link>

                  <div className="my-1 border-t border-white/10" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-[14px] text-[#E6E2D8] hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile expandable search bar */}
        {mobileSearchOpen && (
          <form
            onSubmit={onQuerySubmit}
            className="sm:hidden px-4 pb-3 flex items-center gap-2"
          >
            <div className="flex-1 flex items-center gap-2 rounded-full border border-[#E6E2D8] bg-white px-3.5 py-1.5 text-[13px]">
              <Search className="w-4 h-4 text-[#8A8F8B]" />
              <input
                type="search"
                placeholder="Search stories & authors..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="bg-transparent outline-none placeholder:text-[#8A8F8B] text-[13px] w-full text-[#1B1F1C]"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="p-1 text-[#8A8F8B]"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </form>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1">{children}</div>

      {/* Global Footer */}
      <footer className="border-t border-[#E6E2D8] bg-[#F6F3EC] py-10 mt-auto">
        <div className="mx-auto max-w-270 px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-[13px] text-[#8A8F8B]">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span className="font-newsreader text-[20px] font-semibold text-[#1F3D2F]">
              Quill
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="text-[#5C625E]">
              A quiet space for deliberate thought, long-form essays and
              typographical craft.
            </span>
          </div>

          <div className="flex items-center gap-5">
            <a href="#about" className="hover:text-[#1B1F1C] transition-colors">
              About
            </a>
            <a
              href="#guidelines"
              className="hover:text-[#1B1F1C] transition-colors"
            >
              Guidelines
            </a>
            <a
              href="#submissions"
              className="hover:text-[#1B1F1C] transition-colors"
            >
              Submissions
            </a>
            <a href="#rss" className="hover:text-[#1B1F1C] transition-colors">
              RSS
            </a>
          </div>
        </div>
      </footer>

      {/* Clearance for the fixed mobile bottom nav (incl. notched phones)
          so the footer is never hidden behind it */}
      <div
        aria-hidden
        className="h-[max(4rem,calc(4rem+env(safe-area-inset-bottom)))] sm:hidden"
      />

      {/* Mobile Bottom Nav Bar (Home, Write, Saved) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#E6E2D8] bg-[#F6F3EC]/95 backdrop-blur-md px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around text-xs text-[#5C625E]">
        <Link
          to="/feed"
          className={`flex flex-col items-center gap-1 ${
            location.pathname === "/feed" ? "text-[#1F3D2F] font-medium" : ""
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </Link>

        <Link
          to="/write"
          className="flex flex-col items-center gap-1 text-[#1F3D2F]"
        >
          <PenSquare className="w-5 h-5" />
          <span>Write</span>
        </Link>

        <Link
          to="/profile"
          className="flex flex-col items-center gap-1 hover:text-[#1F3D2F]"
        >
          <Bookmark className="w-5 h-5" />
          <span>Saved</span>
        </Link>
      </nav>
    </div>
  );
};

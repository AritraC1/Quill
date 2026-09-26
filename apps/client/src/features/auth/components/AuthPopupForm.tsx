import { useState, type FormEvent, useEffect } from "react";
import type { AuthPopupFormProps, View } from "../types";
import { FaGoogle, FaFacebook } from "react-icons/fa";
import { Mail, XIcon } from "lucide-react";

const SocialButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="relative w-full rounded-full border border-neutral-900 py-3.5 px-5 text-[15px] font-medium text-neutral-900 transition-colors hover:bg-neutral-100 active:bg-neutral-200"
  >
    <span className="absolute left-5 top-1/2 -translate-y-1/2">{icon}</span>
    {label}
  </button>
);

const RememberMe = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex select-none items-center justify-center gap-2.5 text-[15px] text-neutral-800">
    <span className="relative inline-flex h-4.5 w-4.5 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="pointer-events-none flex h-4.5 w-4.5 items-center justify-center rounded-sm border border-neutral-900 bg-white peer-checked:bg-neutral-900">
        {checked && (
          <svg
            width="11"
            height="9"
            viewBox="0 0 11 9"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 4.3 3.8 7 10 1"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </span>
    Remember me for faster sign in
  </label>
);

const AuthPopupForm = ({
  isOpen,
  onClose,
  initialView = "joinOptions",
}: AuthPopupFormProps) => {
  const [view, setView] = useState<View>(initialView);
  const [remember, setRemember] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [signinEmail, setSigninEmail] = useState("");

  // Reset to the requested starting view every time the modal transitions
  // from closed to open. This adjusts state *during render* (React's
  // recommended pattern for "state derived from a prop change") instead of
  // in an effect, so it doesn't trigger a second, cascading render pass.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setView(initialView);
    }
  }

  // Esc to close.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateAccount = (e: FormEvent) => {
    e.preventDefault();
  };

  const handleSigninContinue = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 backdrop-blur-sm p-4 sm:p-8"
      onMouseDown={(e) => {
        // Close only when the click originated on the backdrop itself.
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative max-h-[90vh] w-full max-w-125 overflow-y-auto rounded-2xl border border-neutral-200 bg-white px-6 py-10 shadow-xl sm:px-10 sm:py-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 text-neutral-400 transition-colors hover:text-neutral-700"
        >
          <XIcon />
        </button>

        {/* JOIN — sign up options */}
        {view === "joinOptions" && (
          <div className="flex flex-col gap-8">
            <h1 className="text-center font-serif text-[34px] leading-tight text-neutral-900 sm:text-[40px]">
              Join Quill.
            </h1>

            <div className="flex flex-col gap-3.5">
              <SocialButton
                icon={<FaGoogle size={24} />}
                label="Sign up with Google"
              />
              <SocialButton
                icon={<FaFacebook size={24} />}
                label="Sign up with Facebook"
              />
              <SocialButton
                icon={<Mail />}
                label="Sign up with email"
                onClick={() => setView("joinEmail")}
              />
            </div>

            <RememberMe checked={remember} onChange={setRemember} />

            <p className="text-center text-[15px] text-neutral-800">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setView("signinOptions")}
                className="underline underline-offset-2 hover:text-neutral-900"
              >
                Sign in
              </button>
            </p>
          </div>
        )}

        {/* JOIN — email form */}
        {view === "joinEmail" && (
          <form onSubmit={handleCreateAccount} className="flex flex-col gap-8">
            <div className="flex flex-col items-center gap-5">
              <h1 className="text-center font-serif text-[32px] leading-tight text-neutral-900 sm:text-[38px]">
                Sign up with email
              </h1>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="fullName"
                  className="text-[15px] text-neutral-900"
                >
                  Your full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="rounded-lg bg-neutral-100 px-4 py-3.5 text-[15px] text-neutral-900 placeholder:text-neutral-500 outline-none ring-1 ring-transparent focus:ring-neutral-900"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="joinEmailInput"
                  className="text-[15px] text-neutral-900"
                >
                  Your email
                </label>
                <input
                  id="joinEmailInput"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="rounded-lg bg-neutral-100 px-4 py-3.5 text-[15px] text-neutral-900 placeholder:text-neutral-500 outline-none ring-1 ring-transparent focus:ring-neutral-900"
                />
              </div>
            </div>

            <RememberMe checked={remember} onChange={setRemember} />

            <button
              type="submit"
              className="mx-auto w-full max-w-65 rounded-full bg-neutral-900 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Create account
            </button>

            <div className="flex flex-col items-center gap-3 text-[15px] text-neutral-800">
              <button
                type="button"
                onClick={() => setView("joinOptions")}
                className="underline underline-offset-2 hover:text-neutral-900"
              >
                Back to sign up options
              </button>
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setView("signinOptions")}
                  className="underline underline-offset-2 hover:text-neutral-900"
                >
                  Sign in
                </button>
              </p>
            </div>
          </form>
        )}

        {/* SIGN IN — options */}
        {view === "signinOptions" && (
          <div className="flex flex-col gap-8">
            <h1 className="text-center font-serif text-[34px] leading-tight text-neutral-900 sm:text-[40px]">
              Welcome back.
            </h1>

            <div className="flex flex-col gap-3.5">
              <SocialButton
                icon={<FaGoogle size={24} />}
                label="Sign in with Google"
              />
              <SocialButton
                icon={<FaFacebook size={24} />}
                label="Sign in with Facebook"
              />
              <SocialButton
                icon={<Mail />}
                label="Sign in with email"
                onClick={() => setView("signinEmail")}
              />
            </div>

            <RememberMe checked={remember} onChange={setRemember} />

            <div className="flex flex-col items-center gap-3 text-[15px] text-neutral-800">
              <p>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => setView("joinOptions")}
                  className="underline underline-offset-2 hover:text-neutral-900"
                >
                  Create one
                </button>
              </p>
              <p>
                Forgot email or trouble signing in?{" "}
                <a
                  href="#"
                  className="underline underline-offset-2 hover:text-neutral-900"
                >
                  Get help
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* SIGN IN — email form */}
        {view === "signinEmail" && (
          <form onSubmit={handleSigninContinue} className="flex flex-col gap-8">
            <div className="flex flex-col items-center gap-5">
              <h1 className="text-center font-serif text-[32px] leading-tight text-neutral-900 sm:text-[38px]">
                Sign in with email
              </h1>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="signinEmailInput"
                className="text-[15px] text-neutral-900"
              >
                Your email
              </label>
              <input
                id="signinEmailInput"
                type="email"
                value={signinEmail}
                onChange={(e) => setSigninEmail(e.target.value)}
                placeholder="Enter your email address"
                className="rounded-lg bg-neutral-100 px-4 py-3.5 text-[15px] text-neutral-900 placeholder:text-neutral-500 outline-none ring-1 ring-transparent focus:ring-neutral-900"
              />
            </div>

            <RememberMe checked={remember} onChange={setRemember} />

            <button
              type="submit"
              className="mx-auto w-full max-w-65 rounded-full bg-neutral-900 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Continue
            </button>

            <button
              type="button"
              onClick={() => setView("signinOptions")}
              className="mx-auto text-[15px] text-neutral-800 underline underline-offset-2 hover:text-neutral-900"
            >
              Back to sign in options
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPopupForm;

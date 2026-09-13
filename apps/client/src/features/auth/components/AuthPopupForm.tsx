import { useState, type FormEvent, useEffect } from "react";

type View = "joinOptions" | "joinEmail" | "signinOptions" | "signinEmail";

interface AuthPopupFormProps {
  /** Controls whether the modal is rendered/visible. */
  isOpen: boolean;
  /** Called when the user closes the modal (backdrop click, Esc, close icon). */
  onClose: () => void;
  /** Which panel to open on first render. Defaults to the sign-up options. */
  initialView?: View;
}

/* ---------------------------------- Icons --------------------------------- */

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <path
      d="M19.6 10.23c0-.68-.06-1.32-.17-1.94H10v3.68h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.26z"
      fill="#4285F4"
    />
    <path
      d="M10 20c2.7 0 4.96-.9 6.61-2.43l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H1.07v2.59A10 10 0 0 0 10 20z"
      fill="#34A853"
    />
    <path
      d="M4.41 11.9A6 6 0 0 1 4.09 10c0-.66.11-1.3.32-1.9V5.51H1.07A10 10 0 0 0 0 10c0 1.61.39 3.14 1.07 4.49l3.34-2.6z"
      fill="#FBBC05"
    />
    <path
      d="M10 3.98c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.53 9.53 0 0 0 10 0 10 10 0 0 0 1.07 5.51l3.34 2.59C5.2 5.74 7.4 3.98 10 3.98z"
      fill="#EA4335"
    />
  </svg>
);

const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="10" fill="#1877F2" />
    <path
      d="M13.5 12.8l.44-2.8h-2.69V8.2c0-.77.38-1.51 1.6-1.51h1.24V4.3s-1.12-.19-2.2-.19c-2.24 0-3.71 1.36-3.71 3.81v2.08H5.75v2.8h2.43V19.8c.49.08.99.12 1.5.12s1.01-.04 1.5-.12v-7h2.32z"
      fill="#fff"
    />
  </svg>
);

const MailIcon = ({ className = "" }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <rect x="2" y="4" width="16" height="12" rx="1.5" stroke="currentColor" fill="none" strokeWidth="1.3" />
    <path d="M2.5 5 10 11l7.5-6" stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MailBig = () => (
  <svg width="64" height="46" viewBox="0 0 64 46" aria-hidden="true" fill="none">
    <path
      d="M9 2 60 2 60 34 15 34"
      stroke="#1A1A1A"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 2 34.5 22 60 2"
      stroke="#1A1A1A"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M2 40 8 37" stroke="#1A1A1A" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M1 34 9 30" stroke="#1A1A1A" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M2 2 18 18M18 2 2 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

/* ------------------------------ Reusable bits ------------------------------ */

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
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
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

/* --------------------------------- Modal ----------------------------------- */

const AuthPopupForm = ({ isOpen, onClose, initialView = "joinOptions" }: AuthPopupFormProps) => {
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
          <CloseIcon />
        </button>

        {/* ---------------- JOIN — sign up options ---------------- */}
        {view === "joinOptions" && (
          <div className="flex flex-col gap-8">
            <h1 className="text-center font-serif text-[34px] leading-tight text-neutral-900 sm:text-[40px]">
              Join Quill.
            </h1>

            <div className="flex flex-col gap-3.5">
              <SocialButton icon={<GoogleIcon />} label="Sign up with Google" />
              <SocialButton icon={<FacebookIcon />} label="Sign up with Facebook" />
              <SocialButton
                icon={<MailIcon />}
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

        {/* ---------------- JOIN — email form ---------------- */}
        {view === "joinEmail" && (
          <form onSubmit={handleCreateAccount} className="flex flex-col gap-8">
            <div className="flex flex-col items-center gap-5">
              <MailBig />
              <h1 className="text-center font-serif text-[32px] leading-tight text-neutral-900 sm:text-[38px]">
                Sign up with email
              </h1>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="fullName" className="text-[15px] text-neutral-900">
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
                <label htmlFor="joinEmailInput" className="text-[15px] text-neutral-900">
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

        {/* ---------------- SIGN IN — options ---------------- */}
        {view === "signinOptions" && (
          <div className="flex flex-col gap-8">
            <h1 className="text-center font-serif text-[34px] leading-tight text-neutral-900 sm:text-[40px]">
              Welcome back.
            </h1>

            <div className="flex flex-col gap-3.5">
              <SocialButton icon={<GoogleIcon />} label="Sign in with Google" />
              <SocialButton icon={<FacebookIcon />} label="Sign in with Facebook" />
              <SocialButton
                icon={<MailIcon />}
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
                <a href="#" className="underline underline-offset-2 hover:text-neutral-900">
                  Get help
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* ---------------- SIGN IN — email form ---------------- */}
        {view === "signinEmail" && (
          <form onSubmit={handleSigninContinue} className="flex flex-col gap-8">
            <div className="flex flex-col items-center gap-5">
              <MailBig />
              <h1 className="text-center font-serif text-[32px] leading-tight text-neutral-900 sm:text-[38px]">
                Sign in with email
              </h1>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="signinEmailInput" className="text-[15px] text-neutral-900">
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
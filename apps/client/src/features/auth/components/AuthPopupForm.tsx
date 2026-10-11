import { useState, type FormEvent, useEffect } from "react";
import type { AuthPopupFormProps, View } from "../types";
import { FaGoogle, FaFacebook } from "react-icons/fa";
import { Mail, XIcon, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import SocialButton from "../../../components/ui/SocialButton";
import RememberMe from "./RememberMe";

const AuthPopupForm = ({
  isOpen,
  onClose,
  initialView = "joinOptions",
  onAuthSuccess,
}: AuthPopupFormProps) => {
  const [view, setView] = useState<View>(initialView);
  const [remember, setRemember] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [signinEmail, setSigninEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const { signUp, requestOtp, verifyOtp, isLoading, error, clearError } =
    useAuth();

  // Reset view when opened
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setView(initialView);
      clearError();
      setFeedbackMessage(null);
      setOtp("");
    }
  }

  // Clear messages when view changes
  const switchView = (nextView: View) => {
    clearError();
    setFeedbackMessage(null);
    setView(nextView);
  };

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

  // Sign up flow: create account then request OTP
  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    try {
      await signUp(fullName, email);
      await requestOtp(email);
      setTargetEmail(email.trim().toLowerCase());
      setFeedbackMessage("Account created! Verification code sent.");
      switchView("verifyOtp");
    } catch {
      // error state set by useAuth
    }
  };

  // Sign in flow: request OTP for existing user
  const handleSigninContinue = async (e: FormEvent) => {
    e.preventDefault();
    if (!signinEmail.trim()) return;

    try {
      await requestOtp(signinEmail);
      setTargetEmail(signinEmail.trim().toLowerCase());
      setFeedbackMessage("Verification code sent to your email.");
      switchView("verifyOtp");
    } catch {
      // error state set by useAuth
    }
  };

  // OTP verification
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !targetEmail) return;

    try {
      const tokens = await verifyOtp(targetEmail, otp);
      if (onAuthSuccess) {
        onAuthSuccess(tokens);
      }
      onClose();
    } catch {
      // error state set by useAuth
    }
  };

  const handleResendOtp = async () => {
    if (!targetEmail || isLoading) return;
    try {
      await requestOtp(targetEmail);
      setFeedbackMessage("New OTP code sent! Use 0000 for testing.");
    } catch {
      // handled
    }
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
                onClick={() => switchView("joinEmail")}
              />
            </div>

            <RememberMe checked={remember} onChange={setRemember} />

            <p className="text-center text-[15px] text-neutral-800">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchView("signinOptions")}
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

            {error && (
              <div className="rounded-lg bg-red-50 p-3.5 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

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
                  required
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
                  required
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
              disabled={isLoading}
              className="mx-auto flex items-center justify-center gap-2 w-full max-w-65 rounded-full bg-neutral-900 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
              {isLoading ? "Creating account..." : "Create account"}
            </button>

            <div className="flex flex-col items-center gap-3 text-[15px] text-neutral-800">
              <button
                type="button"
                onClick={() => switchView("joinOptions")}
                className="underline underline-offset-2 hover:text-neutral-900"
              >
                Back to sign up options
              </button>
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchView("signinOptions")}
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
                onClick={() => switchView("signinEmail")}
              />
            </div>

            <RememberMe checked={remember} onChange={setRemember} />

            <div className="flex flex-col items-center gap-3 text-[15px] text-neutral-800">
              <p>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => switchView("joinOptions")}
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

            {error && (
              <div className="rounded-lg bg-red-50 p-3.5 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

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
                required
                value={signinEmail}
                onChange={(e) => setSigninEmail(e.target.value)}
                placeholder="Enter your email address"
                className="rounded-lg bg-neutral-100 px-4 py-3.5 text-[15px] text-neutral-900 placeholder:text-neutral-500 outline-none ring-1 ring-transparent focus:ring-neutral-900"
              />
            </div>

            <RememberMe checked={remember} onChange={setRemember} />

            <button
              type="submit"
              disabled={isLoading}
              className="mx-auto flex items-center justify-center gap-2 w-full max-w-65 rounded-full bg-neutral-900 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
              {isLoading ? "Sending code..." : "Continue"}
            </button>

            <button
              type="button"
              onClick={() => switchView("signinOptions")}
              className="mx-auto text-[15px] text-neutral-800 underline underline-offset-2 hover:text-neutral-900"
            >
              Back to sign in options
            </button>
          </form>
        )}

        {/* VERIFY OTP FORM */}
        {view === "verifyOtp" && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-8">
            <div className="flex flex-col items-center gap-3">
              <h1 className="text-center font-serif text-[32px] leading-tight text-neutral-900 sm:text-[38px]">
                Enter OTP Code
              </h1>
              <p className="text-center text-sm text-neutral-600">
                We sent a 4-digit code to{" "}
                <span className="font-medium text-neutral-900">
                  {targetEmail}
                </span>
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Test code:{" "}
                <strong>0000</strong>
              </span>
            </div>

            {feedbackMessage && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200">
                {feedbackMessage}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3.5 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="otpInput"
                className="text-[15px] text-neutral-900 text-center"
              >
                Verification Code
              </label>
              <input
                id="otpInput"
                type="text"
                maxLength={6}
                autoFocus
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="0000"
                className="mx-auto w-48 text-center text-2xl tracking-[0.3em] font-mono rounded-lg bg-neutral-100 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 outline-none ring-1 ring-transparent focus:ring-neutral-900"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !otp.trim()}
              className="mx-auto flex items-center justify-center gap-2 w-full max-w-65 rounded-full bg-neutral-900 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
              {isLoading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div className="flex flex-col items-center gap-3 text-[14px] text-neutral-700">
              <p>
                Didn't receive the code?{" "}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="font-medium underline underline-offset-2 hover:text-neutral-900 disabled:opacity-50"
                >
                  Resend code
                </button>
              </p>
              <button
                type="button"
                onClick={() => switchView("signinEmail")}
                className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
              >
                <ArrowLeft className="w-4 h-4" /> Change email address
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPopupForm;

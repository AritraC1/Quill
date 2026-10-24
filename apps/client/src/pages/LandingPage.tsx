import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth";
import CurvedArrow from "../components/ui/CurvedArrow";
import InkIllustration from "../components/ui/InkIllustration";
import AuthPopupForm from "../features/auth/components/AuthPopupForm";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing, logout } = useAuth();

  // Controls the auth modal, and which panel ("join" vs "sign in") it opens on.
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"joinOptions" | "signinOptions">(
    "joinOptions",
  );

  const openAuth = (view: "joinOptions" | "signinOptions") => {
    setAuthView(view);
    setAuthOpen(true);
  };

  // Signed in → go straight into the app. Signed out → open the auth modal.
  const handleStart = () => {
    if (isInitializing) return; // session still being restored, don't open the modal
    if (isAuthenticated) {
      navigate("/feed"); // change to "/write" once that route exists
    } else {
      openAuth("joinOptions");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F3E9] text-[#232A3B] font-['Inter',ui-sans-serif,system-ui]">
      {/* faint paper grain, page-wide */}
      <div
        className="pointer-events-none fixed inset-0 grain"
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative border-b border-[#232A3B]/15">
        <div className="mx-auto flex max-w-334 items-center justify-between px-5 py-5 sm:px-8">
          <a href="#" className="flex items-center gap-2">
            <span className="font-editorial text-2xl font-semibold tracking-tight sm:text-[26px]">
              ✍🏻 Quill
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={logout}
                  className="text-[15px] font-medium text-[#232A3B] hover:text-[#3B6255] transition-colors"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  className="rounded-full bg-[#232A3B] px-5 py-2.5 text-[15px] font-medium text-[#F7F3E9] transition-colors hover:bg-[#3B6255]"
                >
                  Go to Quill
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth("signinOptions")}
                  className="text-[15px] font-medium text-[#232A3B] hover:text-[#3B6255] transition-colors"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  className="rounded-full bg-[#232A3B] px-5 py-2.5 text-[15px] font-medium text-[#F7F3E9] transition-colors hover:bg-[#3B6255]"
                >
                  Start writing
                </button>
              </>
            )}
          </nav>

          {/* Mobile nav */}
          <div className="md:hidden flex items-center gap-3">
            {isAuthenticated && (
              <button
                type="button"
                onClick={logout}
                className="text-sm font-medium text-[#232A3B]"
              >
                Sign out
              </button>
            )}
            <button
              type="button"
              onClick={handleStart}
              className="rounded-full bg-[#232A3B] px-4 py-2 text-sm font-medium text-[#F7F3E9]"
            >
              {isAuthenticated ? "Go to Quill" : "Start writing"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative border-b border-[#232A3B]/15">
        <div className="mx-auto grid max-w-334 grid-cols-1 items-center gap-10 px-5 py-12 sm:px-8 md:grid-cols-2 md:gap-6 md:py-0 md:min-h-160">
          {/* Left: text */}
          <div className="order-2 md:order-1">
            <h1 className="font-editorial text-[13vw] leading-[0.98] tracking-tight sm:text-[56px] md:text-[64px] lg:text-[76px]">
              Some thoughts deserve
              <br />
              better than a group chat.
            </h1>
            <p className="font-editorial mt-6 max-w-md text-lg leading-relaxed text-[#232A3B]/80 sm:text-xl">
              Quill is a quiet room for essays, notes, and long-form thinking —
              no feed to chase, no algorithm deciding who reads you.
            </p>

            <div className="relative mt-9 inline-flex flex-col items-start sm:mt-10 sm:flex-row sm:items-center sm:gap-6">
              <button
                type="button"
                onClick={handleStart}
                className="inline-block rounded-full bg-[#232A3B] px-8 py-4 text-base font-medium text-[#F7F3E9] transition-colors hover:bg-[#3B6255]"
              >
                {isAuthenticated ? "Continue writing" : "Start writing"}
              </button>
              {!isAuthenticated && (
                <span className="mt-3 flex items-center gap-2 sm:mt-0">
                  <CurvedArrow className="hidden h-8 w-12 sm:block" />
                  <span className="font-hand -rotate-2 text-2xl text-[#3B6255]">
                    free while you're drafting
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Right: illustration */}
          <div className="order-1 mb-2 md:order-2 md:mb-0 md:h-150">
            <div className="relative mx-auto h-75 w-75 sm:h-100 sm:w-100 md:h-full md:w-full">
              <InkIllustration />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative">
        <div className="mx-auto flex max-w-334 flex-wrap items-center justify-between gap-3 px-5 py-6 sm:px-8">
          <span className="text-sm text-[#6b6b6b]">
            Quill — started with one draft, {new Date().getFullYear()}.
          </span>
          <nav className="flex flex-wrap justify-end gap-x-6 gap-y-3 text-sm text-[#6b6b6b]">
            <a href="/status" className="hover:text-[#232A3B]">
              Status
            </a>
          </nav>
        </div>
      </footer>

      {/* Auth modal — fixed overlay, blurs everything behind it while open */}
      <AuthPopupForm
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialView={authView}
        onAuthSuccess={(tokens) => {
          if (tokens.onboardingCompleted) {
            navigate("/feed");
          } else {
            navigate("/onboarding");
          }
        }}
      />
    </div>
  );
};

export default LandingPage;

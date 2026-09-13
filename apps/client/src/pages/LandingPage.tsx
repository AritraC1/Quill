import React, { useState } from "react";
import AuthPopupForm from "../features/auth/components/AuthPopupForm";

const QuillMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
    <path
      d="M27 5C18 6 10 13 7 23c-.6 2-1 3.6-1 3.6s1.7-.4 3.7-1C19.6 22.6 26.4 14.6 27 5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M23 9 8.5 23.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M6 26c1.6-.4 3-1 4-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const InkIllustration: React.FC = () => (
  <svg viewBox="0 0 480 560" className="h-full w-full" role="img" aria-labelledby="inkIllustrationTitle">
    <title id="inkIllustrationTitle">A feather quill resting beside an inkwell, mid-sentence</title>
    <g stroke="#232A3B" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.85">
      <path className="quill-stroke" style={{ animationDelay: "0ms" }} d="M60 140 C 130 132, 170 150, 240 138" />
      <path className="quill-stroke" style={{ animationDelay: "140ms" }} d="M60 168 C 110 162, 150 176, 210 166" />
      <path className="quill-stroke" style={{ animationDelay: "280ms" }} d="M60 196 C 95 190, 120 200, 160 194" />
    </g>
    <g>
      <path
        d="M120 420c0-14 12-24 28-24h60c16 0 28 10 28 24v46c0 20-16 34-58 34s-58-14-58-34v-46Z"
        fill="#232A3B"
      />
      <ellipse cx="178" cy="420" rx="58" ry="16" fill="#2C3549" />
      <ellipse cx="178" cy="418" rx="46" ry="10" fill="#3B6255" />
      <path d="M150 396c0-8 12-14 28-14s28 6 28 14" stroke="#232A3B" strokeWidth="6" strokeLinecap="round" fill="none" />
    </g>
    <circle cx="92" cy="486" r="5" fill="#232A3B" opacity="0.9" />
    <circle cx="108" cy="500" r="2.5" fill="#232A3B" opacity="0.7" />
    <path
      d="M330 500c8-6 20-4 22 6 2 9-8 15-18 12-9-3-12-13-4-18Z"
      fill="#A63D2F"
      opacity="0.85"
    />
    <g transform="translate(178 418) rotate(-38)">
      <path
        d="M0 0C-6 -96 30 -190 118 -230c-30 40-22 84-8 118 16 38 8 84-30 108-30 18-58 14-80 4Z"
        fill="#F7F3E9"
        stroke="#232A3B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M0 0C-4 -70 18 -150 92 -196" stroke="#232A3B" strokeWidth="2" fill="none" />
      {Array.from({ length: 9 }).map((_, i) => {
        const t = i / 8;
        const y = -18 - t * 190;
        const len = 26 - t * 10;
        return (
          <path
            key={i}
            d={`M${-2 - t * 22} ${y} q ${len} ${-4} ${len + 10} ${-14}`}
            stroke="#3B6255"
            strokeWidth="1.6"
            fill="none"
            opacity={0.55 + t * 0.3}
          />
        );
      })}
      <rect x="-4" y="-6" width="8" height="34" rx="3" fill="#232A3B" />
    </g>
  </svg>
);

const CurvedArrow: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 90 60" className={className} fill="none" aria-hidden="true">
    <path d="M4 6c8 26 30 40 60 40" stroke="#3B6255" strokeWidth="2" strokeLinecap="round" />
    <path d="M52 38 66 47 60 32" stroke="#3B6255" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LandingPage: React.FC = () => {
  // Controls the auth modal, and which panel ("join" vs "sign in") it opens on.
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"joinOptions" | "signinOptions">("joinOptions");

  const openAuth = (view: "joinOptions" | "signinOptions") => {
    setAuthView(view);
    setAuthOpen(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F3E9] text-[#232A3B] font-['Inter',ui-sans-serif,system-ui]">
      {/* faint paper grain, page-wide */}
      <div className="pointer-events-none fixed inset-0 grain" aria-hidden="true" />

      {/* Header */}
      <header className="relative border-b border-[#232A3B]/15">
        <div className="mx-auto flex max-w-334 items-center justify-between px-5 py-5 sm:px-8">
          <a href="#" className="flex items-center gap-2">
            <QuillMark className="h-6 w-6 -rotate-6 text-[#232A3B]" />
            <span className="font-editorial text-2xl font-semibold tracking-tight sm:text-[26px]">Quill</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            <button
              type="button"
              onClick={() => openAuth("joinOptions")}
              className="rounded-full bg-[#232A3B] px-5 py-2.5 text-[15px] font-medium text-[#F7F3E9] transition-colors hover:bg-[#3B6255]"
            >
              Start writing
            </button>
          </nav>

          <button
            type="button"
            onClick={() => openAuth("joinOptions")}
            className="rounded-full bg-[#232A3B] px-4 py-2 text-sm font-medium text-[#F7F3E9] md:hidden"
          >
            Start writing
          </button>
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
              Quill is a quiet room for essays, notes, and long-form thinking — no feed to
              chase, no algorithm deciding who reads you.
            </p>

            <div className="relative mt-9 inline-flex flex-col items-start sm:mt-10 sm:flex-row sm:items-center sm:gap-6">
              <button
                type="button"
                onClick={() => openAuth("joinOptions")}
                className="inline-block rounded-full bg-[#232A3B] px-8 py-4 text-base font-medium text-[#F7F3E9] transition-colors hover:bg-[#3B6255]"
              >
                Start writing
              </button>
              <span className="mt-3 flex items-center gap-2 sm:mt-0">
                <CurvedArrow className="hidden h-8 w-12 sm:block" />
                <span className="font-hand -rotate-2 text-2xl text-[#3B6255]">
                  free while you're drafting
                </span>
              </span>
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
      />
    </div>
  );
};

export default LandingPage;
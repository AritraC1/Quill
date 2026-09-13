import React from "react";

const QuillMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
    <path
      d="M27 5C18 6 10 13 7 23c-.6 2-1 3.6-1 3.6s1.7-.4 3.7-1C19.6 22.6 26.4 14.6 27 5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M23 9 8.5 23.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M6 26c1.6-.4 3-1 4-2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const CurvedArrow: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 90 60" className={className} fill="none" aria-hidden="true">
    <path
      d="M4 6c8 26 30 40 60 40"
      stroke="#3B6255"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M52 38 66 47 60 32"
      stroke="#3B6255"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// A page that has been torn away, with the quill's line running off the
// torn edge into a spreading blot — the "sentence" simply stops existing.
const TornPageIllustration: React.FC = () => (
  <svg
    viewBox="0 0 480 560"
    className="h-full w-full"
    role="img"
    aria-labelledby="tornPageTitle"
  >
    <title id="tornPageTitle">
      A page torn away mid-sentence, the quill's line trailing into an ink blot
    </title>

    {/* the remaining scrap of page, torn edge on the right */}
    <path
      d="M50 90
         C 130 86, 210 92, 260 88
         C 258 130, 272 160, 262 200
         C 276 240, 250 270, 268 310
         C 252 350, 274 384, 256 420
         C 264 452, 246 478, 258 500
         L 50 500 Z"
      fill="#FFFFFF"
      opacity="0.5"
      stroke="#232A3B"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />

    {/* ruled lines on the scrap, stopping before the torn edge */}
    <g stroke="#232A3B" strokeWidth="1.2" opacity="0.18">
      <line x1="66" y1="150" x2="220" y2="147" />
      <line x1="66" y1="178" x2="228" y2="176" />
      <line x1="66" y1="206" x2="214" y2="205" />
      <line x1="66" y1="234" x2="236" y2="234" />
      <line x1="66" y1="262" x2="210" y2="263" />
    </g>

    {/* the sentence itself — ink strokes that run to the tear and stop */}
    <g
      stroke="#232A3B"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.85"
    >
      <path
        className="quill-stroke"
        style={{ animationDelay: "0ms" }}
        d="M78 150 C 120 144, 150 156, 196 148"
      />
      <path
        className="quill-stroke"
        style={{ animationDelay: "140ms" }}
        d="M78 178 C 110 172, 140 184, 200 176"
      />
      <path
        className="quill-stroke"
        style={{ animationDelay: "280ms" }}
        d="M78 206 C 100 200, 122 210, 158 206"
      />
    </g>

    {/* torn edge, drawn jagged and slightly separated from the scrap */}
    <path
      d="M260 88 L266 108 L256 126 L270 150 L258 168 L272 192
         L260 212 L274 236 L262 258 L276 282 L262 304
         L272 328 L258 350 L270 374 L256 396 L268 420
         L254 444 L266 468 L256 500"
      fill="none"
      stroke="#232A3B"
      strokeWidth="1.8"
      strokeLinejoin="round"
      opacity="0.55"
    />

    {/* where the sentence would have continued — a spreading blot */}
    <g transform="translate(300 195)">
      <path
        d="M0 0
           C 30 -18, 62 -10, 74 14
           C 88 40, 70 66, 40 72
           C 10 78, -22 62, -24 34
           C -26 12, -18 10, 0 0 Z"
        fill="#232A3B"
        opacity="0.92"
      />
      <circle cx="86" cy="30" r="6" fill="#232A3B" opacity="0.8" />
      <circle cx="98" cy="44" r="3" fill="#232A3B" opacity="0.6" />
      <circle cx="4" cy="82" r="4" fill="#232A3B" opacity="0.5" />
      <circle cx="-18" cy="70" r="2" fill="#232A3B" opacity="0.4" />
    </g>

    {/* quill, dropped across the blot, nib still touching it */}
    <g transform="translate(300 205) rotate(24)">
      <path
        d="M0 0C-4 -84 22 -166 92 -202c-26 35-18 74-6 104 14 33 6 74-27 95-27 16-52 12-71 3Z"
        fill="#F7F3E9"
        stroke="#232A3B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M0 0C-3 -61 14 -132 78 -172"
        stroke="#232A3B"
        strokeWidth="2"
        fill="none"
      />
      {Array.from({ length: 8 }).map((_, i) => {
        const t = i / 7;
        const y = -16 - t * 166;
        const len = 22 - t * 8;
        return (
          <path
            key={i}
            d={`M${-2 - t * 19} ${y} q ${len} ${-4} ${len + 9} ${-12}`}
            stroke="#3B6255"
            strokeWidth="1.5"
            fill="none"
            opacity={0.5 + t * 0.3}
          />
        );
      })}
      <rect x="-4" y="-5" width="8" height="30" rx="3" fill="#232A3B" />
    </g>
  </svg>
);

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#F7F3E9] text-[#232A3B] font-['Inter',ui-sans-serif,system-ui]">
      <div
        className="pointer-events-none fixed inset-0 grain"
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative border-b border-[#232A3B]/15">
        <div className="mx-auto flex max-w-334 items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="flex items-center gap-2">
            <QuillMark className="h-6 w-6 -rotate-6 text-[#232A3B]" />
            <span className="font-editorial text-2xl font-semibold tracking-tight sm:text-[26px]">
              Quill
            </span>
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="relative border-b border-[#232A3B]/15">
        <div className="mx-auto grid max-w-334 grid-cols-1 items-center gap-10 px-5 py-12 sm:px-8 md:grid-cols-2 md:gap-6 md:py-0 md:min-h-160">
          <div className="order-2 md:order-1">
            <span className="font-editorial block text-lg text-[#232A3B]/60">
              404
            </span>
            <h1 className="font-editorial mt-2 text-[13vw] leading-[0.98] tracking-tight sm:text-[56px] md:text-[64px] lg:text-[76px]">
              This page was never
              <br />
              drafted.
            </h1>
            <p className="font-editorial mt-6 max-w-md text-lg leading-relaxed text-[#232A3B]/80 sm:text-xl">
              Whatever was meant to be here got torn out before it was
              finished. Check the address, or head back and start a fresh
              page.
            </p>

            <div className="relative mt-9 inline-flex flex-col items-start sm:mt-10 sm:flex-row sm:items-center sm:gap-6">
              <a
                href="/"
                className="inline-block rounded-full bg-[#232A3B] px-8 py-4 text-base font-medium text-[#F7F3E9] transition-colors hover:bg-[#3B6255]"
              >
                Back to Quill
              </a>
              <span className="mt-3 flex items-center gap-2 sm:mt-0">
                <CurvedArrow className="hidden h-8 w-12 sm:block" />
                <span className="font-hand -rotate-2 text-2xl text-[#3B6255]">
                  no charge for the wrong turn
                </span>
              </span>
            </div>
          </div>

          <div className="order-1 mb-2 md:order-2 md:mb-0 md:h-150">
            <div className="relative mx-auto h-75 w-75 sm:h-100 sm:w-100 md:h-full md:w-full">
              <TornPageIllustration />
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
    </div>
  );
};

export default NotFoundPage;
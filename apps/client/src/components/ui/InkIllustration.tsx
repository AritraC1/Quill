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

export default InkIllustration;
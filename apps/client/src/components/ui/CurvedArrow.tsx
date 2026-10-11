const CurvedArrow: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 90 60" className={className} fill="none" aria-hidden="true">
    <path d="M4 6c8 26 30 40 60 40" stroke="#3B6255" strokeWidth="2" strokeLinecap="round" />
    <path d="M52 38 66 47 60 32" stroke="#3B6255" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default CurvedArrow;
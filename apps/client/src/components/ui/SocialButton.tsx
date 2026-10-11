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

export default SocialButton;

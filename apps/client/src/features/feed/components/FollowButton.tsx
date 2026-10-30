const FollowButton = ({
  following,
  onClick,
  disabled = false,
}: {
  following: boolean;
  onClick: () => void;
  /** Disabled while a follow request is in flight — blocks overlapping taps */
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={following}
    className={`h-7 shrink-0 rounded-full px-3 text-[12px] font-medium border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
      following
        ? "border-transparent bg-[#EAE6DD] text-[#5C625E] hover:bg-[#DFDBD2]"
        : "border-[#E6E2D8] text-[#1F3D2F] hover:border-[#1F3D2F]"
    }`}
  >
    {disabled
      ? "…"
      : following ? "Following" : "Follow"}
  </button>
);

export default FollowButton;

const FollowButton = ({
  following,
  onClick,
}: {
  following: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={following}
    className={`h-7 shrink-0 rounded-full px-3 text-[12px] font-medium border transition-colors ${
      following
        ? "border-transparent bg-[#EAE6DD] text-[#5C625E] hover:bg-[#DFDBD2]"
        : "border-[#E6E2D8] text-[#1F3D2F] hover:border-[#1F3D2F]"
    }`}
  >
    {following ? "Following" : "Follow"}
  </button>
);

export default FollowButton;

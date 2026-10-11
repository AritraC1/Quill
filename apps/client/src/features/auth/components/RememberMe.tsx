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
          <svg
            width="11"
            height="9"
            viewBox="0 0 11 9"
            fill="none"
            aria-hidden="true"
          >
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

export default RememberMe;

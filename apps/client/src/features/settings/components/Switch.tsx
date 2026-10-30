const Switch = ({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange?.(!checked)}
    className={`relative h-6 w-10.5 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? "bg-[#1F3D2F]" : "bg-[#CFCBC0]"
    }`}
  >
    <span
      className={`absolute top-0.75 left-0.75 h-4.5 w-4.5 rounded-full bg-white transition-transform ${
        checked ? "translate-x-4.5" : ""
      }`}
    />
  </button>
);

export default Switch;
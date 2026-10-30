export type BtnVariant = "default" | "primary" | "danger" | "outlineDanger";

const Button = ({
  variant = "default",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
}) => {
  const styles: Record<BtnVariant, string> = {
    default:
      "border border-[#E6E2D8] bg-white text-[#1B1F1C] hover:bg-[#F4F1EA]",
    primary: "bg-[#1F3D2F] text-white hover:bg-[#2A5240]",
    danger: "bg-[#A63A2F] text-white hover:bg-[#8C2F26]",
    outlineDanger:
      "border border-[#E8C4BF] text-[#A63A2F] bg-white hover:bg-[#FBEFED]",
  };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
};

export default Button;
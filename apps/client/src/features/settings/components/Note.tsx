import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

const Note = ({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn";
  children: ReactNode;
}) => {
  const Icon = tone === "warn" ? AlertTriangle : Info;
  const color =
    tone === "warn"
      ? "bg-[#F6ECD0] text-[#7A5A12]"
      : "bg-[#E4EEE8] text-[#1F3D2F]";
  return (
    <div className={`flex gap-2.5 rounded-lg px-3.5 py-3 text-[13px] ${color}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
};

export default Note;

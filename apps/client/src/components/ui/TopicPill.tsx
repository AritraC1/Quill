import type { HTMLAttributes } from "react";

interface TopicPillProps extends HTMLAttributes<HTMLSpanElement> {
  topic: string;
  isActive?: boolean;
}

export const TopicPill = ({
  topic,
  isActive,
  className = "",
  ...props
}: TopicPillProps) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-normal transition-colors cursor-pointer select-none ${
        isActive
          ? "bg-[#1F3D2F] text-white"
          : "bg-[#F0EDE4] text-[#1B1F1C] hover:bg-[#E6E2D8]"
      } ${className}`}
      {...props}
    >
      {topic}
    </span>
  );
};

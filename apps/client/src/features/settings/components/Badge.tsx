import type { ReactNode } from "react";

const Badge = ({
  tone = "soon",
  children,
}: {
  tone?: "soon" | "ok" | "neutral";
  children: ReactNode;
}) => {
  const tones = {
    soon: "bg-[#F6ECD0] text-[#7A5A12]",
    ok: "bg-[#DCEBE2] text-[#1F3D2F]",
    neutral: "bg-[#EAE6DD] text-[#5C625E]",
  };
  return (
    <span
      className={`ml-2 inline-block rounded-full px-2.5 py-0.5 align-middle text-[12px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

export default Badge;

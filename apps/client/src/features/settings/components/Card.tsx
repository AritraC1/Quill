import type { ReactNode } from "react";

const Card = ({
  title,
  danger,
  children,
}: {
  title?: string;
  danger?: boolean;
  children: ReactNode;
}) => (
  <section
    className={`mb-5 overflow-hidden rounded-xl border bg-white ${
      danger ? "border-[#E8C4BF]" : "border-[#E6E2D8]"
    }`}
  >
    {title && (
      <h3
        className={`font-editorial px-5 pt-4 text-[18px] ${
          danger ? "text-[#A63A2F]" : "text-[#1B1F1C]"
        }`}
      >
        {title}
      </h3>
    )}
    <div className="divide-y divide-[#E6E2D8]">{children}</div>
  </section>
);

export default Card;

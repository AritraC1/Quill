import type { ReactNode } from "react";

const Row = ({
  title,
  description,
  children,
  stacked,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  stacked?: boolean;
}) => (
  <div
    className={`flex gap-4 px-5 py-4 ${
      stacked
        ? "flex-col"
        : "flex-col items-start sm:flex-row sm:items-center sm:justify-between"
    }`}
  >
    {(title || description) && (
      <div className="min-w-0">
        {title && (
          <div className="text-[15px] font-semibold text-[#1B1F1C]">
            {title}
          </div>
        )}
        {description && (
          <p className="mt-0.5 max-w-[52ch] text-[13px] text-[#5C625E]">
            {description}
          </p>
        )}
      </div>
    )}
    {children}
  </div>
);

export default Row;

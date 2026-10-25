import { Link } from "react-router-dom";

const EmptyState = ({
  title,
  body,
  ctaLabel,
  ctaTo,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaTo?: string;
}) => (
  <div className="py-16 text-center">
    <p className="font-editorial text-[20px] text-[#1B1F1C]">{title}</p>
    <p className="mt-2 text-[14px] text-[#5C625E] max-w-sm mx-auto">{body}</p>
    {ctaLabel && ctaTo && (
      <Link
        to={ctaTo}
        className="mt-5 inline-flex items-center rounded-full bg-[#1F3D2F] px-4 h-9 text-[13px] font-medium text-white hover:bg-[#2A5240] transition-colors"
      >
        {ctaLabel}
      </Link>
    )}
  </div>
);

export default EmptyState;
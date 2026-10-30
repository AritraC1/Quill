const PageHeading = ({ title, lead }: { title: string; lead: string }) => (
  <>
    <h1 className="font-editorial text-[28px] leading-tight tracking-tight text-[#1B1F1C] sm:text-[32px]">
      {title}
    </h1>
    <p className="mt-1 mb-6 text-[15px] text-[#5C625E]">{lead}</p>
  </>
);

export default PageHeading;

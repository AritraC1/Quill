const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="py-16 text-center">
    <p className="font-editorial text-[20px] text-[#1B1F1C]">{title}</p>
    <p className="mt-2 text-[14px] text-[#5C625E] max-w-sm mx-auto">{body}</p>
  </div>
);

export default Empty;

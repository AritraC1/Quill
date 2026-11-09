import {
  useMemo,
  useRef,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { Plus } from "lucide-react";
import { ASSET_MIME, uploadImages, type MediaAsset } from "../lib/media";

interface MediaAssetsProps {
  /** Markdown content — images already in the story show up here too */
  content: string;
  /** Files uploaded in this session */
  uploads: MediaAsset[];
  onUploaded: (assets: MediaAsset[]) => void;
  /** Click on a thumbnail inserts it at the cursor */
  onInsert: (asset: MediaAsset) => void;
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

export const MediaAssets = ({
  content,
  uploads,
  onUploaded,
  onInsert,
}: MediaAssetsProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const assets = useMemo(() => {
    const byUrl = new Map<string, MediaAsset>();
    uploads.forEach((a) => byUrl.set(a.url, a));
    for (const m of content.matchAll(IMAGE_RE)) {
      const url = m[2];
      if (url && !byUrl.has(url))
        byUrl.set(url, { id: url, name: m[1] || "image", url });
    }
    return [...byUrl.values()];
  }, [content, uploads]);

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    const added = await uploadImages(files);
    if (added.length > 0) onUploaded(added);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void upload(files);
  };

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    if (e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    void upload(Array.from(e.dataTransfer.files));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, asset: MediaAsset) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onInsert(asset);
    }
  };

  return (
    <section
      aria-label="Media assets"
      className="mt-8 border-t border-[#E6E2D8] pt-5"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] font-medium text-[#5C625E]">Media assets</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-[#1F3D2F] transition-colors hover:bg-[#F0EDE4]"
        >
          <Plus className="h-3.5 w-3.5" />
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          tabIndex={-1}
          className="hidden"
          onChange={onPick}
        />
      </div>

      {assets.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-[#D8D3C5] px-3 py-6 text-center text-[12px] leading-5 text-[#8A8F8B] transition-colors hover:border-[#1F3D2F] hover:text-[#1F3D2F]"
        >
          Upload images or drop them here, then drag them into your story.
        </button>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2">
            {assets.map((asset) => (
              <li key={asset.url}>
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  title="Click to insert, or drag into the story"
                  onClick={() => onInsert(asset)}
                  onKeyDown={(e) => onKey(e, asset)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(ASSET_MIME, JSON.stringify(asset));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="cursor-grab overflow-hidden rounded-md border border-[#E6E2D8] bg-white transition-colors hover:border-[#1F3D2F] focus-visible:outline-2 focus-visible:outline-[#1F3D2F] active:cursor-grabbing"
                >
                  <img
                    src={asset.url}
                    alt=""
                    draggable={false}
                    className="h-16 w-full object-cover"
                  />
                  <p className="truncate px-1.5 py-1 text-[11px] text-[#5C625E]">
                    {asset.name}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-4 text-[#8A8F8B]">
            Drag into the story, or click to insert at the cursor.
          </p>
        </>
      )}
    </section>
  );
};

export default MediaAssets;

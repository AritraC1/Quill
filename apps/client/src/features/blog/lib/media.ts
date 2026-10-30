import { toast } from "sonner";

export interface MediaAsset {
  id: string;
  /** Original file name, shown under the thumbnail */
  name: string;
  /** What ends up inside the markdown: ![alt](url) */
  url: string;
}

/** Drag payload type used between the asset library and the editor */
export const ASSET_MIME = "application/x-quill-asset";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1600;

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(blob);
  });

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read ${file.name}`));
    };
    img.src = objectUrl;
  });

/**
 * Turns a picked file into an asset. Right now the image is downscaled and
 * stored inline as a data URL, so it saves with the post and needs no backend.
 * To use a real upload endpoint later, replace the body of this function with
 * your API call and return the hosted URL — nothing else has to change.
 */
export const uploadImage = async (file: File): Promise<MediaAsset> => {
  if (!file.type.startsWith("image/"))
    throw new Error(`${file.name} is not an image`);

  if (file.size > MAX_BYTES)
    throw new Error(`${file.name} is larger than 10 MB`);

  let url: string;
  // GIFs are kept as-is so animation survives (SVG is rasterized below, since
  // only png/jpeg/gif/webp data URLs are allowed to render)
  if (file.type === "image/gif") {
    url = await readAsDataUrl(file);
  } 
  else {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    url = canvas.toDataURL("image/webp", 0.85);
  }

  return { id: crypto.randomUUID(), name: file.name, url };
};

/** Uploads several files, toasting the ones that fail and returning the rest */
export const uploadImages = async (files: File[]): Promise<MediaAsset[]> => {
  const done: MediaAsset[] = [];
  for (const file of files) {
    try {
      done.push(await uploadImage(file));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add that image",
      );
    }
  }
  return done;
};

// ---------------------------------------------------------------------------
// Short image tokens for the markdown view.
// Stored markdown keeps the full data URL, but the markdown textarea shows
//   ![alt](img:1a2b3c)
// and converts back to the full URL before anything is saved.
// ---------------------------------------------------------------------------

const DATA_IMAGE =
  /!\[([^\]]*)\]\((data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)\)/g;
const TOKEN_IMAGE = /!\[([^\]]*)\]\(img:([a-z0-9]+)\)/g;

const idToUrl = new Map<string, string>();
const urlToId = new Map<string, string>();

const hashUrl = (value: string): string => {
  let h = 5381;
  for (let i = 0; i < value.length; i++)
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + value.length.toString(36);
};

/** "img:<id>" for inline images, the URL itself for hosted ones */
export const shortImageUrl = (url: string): string => {
  if (!url.startsWith("data:image/")) return url;
  let id = urlToId.get(url);
  if (!id) {
    id = hashUrl(url);
    urlToId.set(url, id);
    idToUrl.set(id, url);
  }
  return `img:${id}`;
};

/** Full markdown -> what the textarea shows */
export const collapseImages = (md: string): string =>
  md.replace(
    DATA_IMAGE,
    (_m, alt: string, url: string) => `![${alt}](${shortImageUrl(url)})`,
  );

/** What the textarea shows -> full markdown (unknown tokens are left as typed) */
export const expandImages = (md: string): string =>
  md.replace(TOKEN_IMAGE, (m, alt: string, id: string) => {
    const url = idToUrl.get(id);
    return url ? `![${alt}](${url})` : m;
  });

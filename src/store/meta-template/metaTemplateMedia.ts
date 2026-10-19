// Media library for IMAGE/VIDEO template headers. Port of the listing in cw-arqos
// app/javascript/dashboard/components-next/whatsapp/WabaImagePicker.vue (~:39): a public S3
// ListObjectsV2 on the `waba-images` bucket, one folder per template type. It is a direct
// HTTP call (public bucket, not the Chatwoot API), so it does not go through apiService.
// Like the web, only the first page (S3 default 1000 keys) is read.

export const WABA_MEDIA_BUCKET_URL = 'https://s3.arqos.online/waba-images';
const THUMBNAIL_PREFIX = 'https://thumbs.arqos.online/insecure/rs:fill:200:200/plain/';

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|avi|webm)$/i;

export type WabaMediaContent = 'image' | 'video';

export interface WabaMediaItem {
  key: string;
  url: string;
  thumbnailUrl: string;
  name: string;
  isImage: boolean;
  isVideo: boolean;
}

/** Same query as the web: `list-type=2`, plus `prefix=<type>/` unless the type is "other". */
export const buildWabaMediaListUrl = (templateType: string | null | undefined): string => {
  let url = `${WABA_MEDIA_BUCKET_URL}?list-type=2`;
  if (templateType && templateType.toLowerCase() !== 'other') {
    url += `&prefix=${encodeURIComponent(`${templateType.toLowerCase()}/`)}`;
  }
  return url;
};

const decodeXml = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');

// RN has no DOMParser: the ListBucketResult is flat enough to read with regexes.
export const parseWabaMediaList = (xml: string, content: WabaMediaContent): WabaMediaItem[] => {
  const items: WabaMediaItem[] = [];
  const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
  contents.forEach(block => {
    const keyMatch = block.match(/<Key>([\s\S]*?)<\/Key>/);
    if (!keyMatch) return;
    const key = decodeXml(keyMatch[1]);
    const url = `${WABA_MEDIA_BUCKET_URL}/${key}`;
    const isImage = IMAGE_EXT.test(key);
    const isVideo = VIDEO_EXT.test(key);
    items.push({
      key,
      url,
      thumbnailUrl: isImage ? `${THUMBNAIL_PREFIX}${url}` : url,
      name: key.split('/').pop() || key,
      isImage,
      isVideo,
    });
  });
  return items.filter(item => (content === 'video' ? item.isVideo : item.isImage));
};

export const fetchWabaMedia = async (
  templateType: string | null | undefined,
  content: WabaMediaContent,
): Promise<WabaMediaItem[]> => {
  const response = await fetch(buildWabaMediaListUrl(templateType));
  if (!response.ok) {
    throw new Error(`waba-images listing failed: ${response.status}`);
  }
  return parseWabaMediaList(await response.text(), content);
};

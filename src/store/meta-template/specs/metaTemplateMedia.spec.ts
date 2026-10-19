import {
  WABA_MEDIA_BUCKET_URL,
  buildWabaMediaListUrl,
  fetchWabaMedia,
  parseWabaMediaList,
} from '../metaTemplateMedia';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>waba-images</Name><Prefix>followup/</Prefix><KeyCount>5</KeyCount>
  <Contents><Key>followup/</Key><Size>0</Size></Contents>
  <Contents><Key>followup/fachada.JPG</Key><Size>10</Size></Contents>
  <Contents>
    <Key>followup/tour &amp; planta.mp4</Key><Size>20</Size>
  </Contents>
  <Contents><Key>followup/folder.pdf</Key></Contents>
  <Contents><Key>followup/sub/piscina.webp</Key></Contents>
</ListBucketResult>`;

describe('buildWabaMediaListUrl', () => {
  it('lists the folder of the template type, lowercased (same query as the web)', () => {
    expect(buildWabaMediaListUrl('FollowUp')).toBe(
      'https://s3.arqos.online/waba-images?list-type=2&prefix=followup%2F',
    );
  });

  it('lists the whole bucket for "other" or no type', () => {
    expect(buildWabaMediaListUrl('Other')).toBe(`${WABA_MEDIA_BUCKET_URL}?list-type=2`);
    expect(buildWabaMediaListUrl('')).toBe(`${WABA_MEDIA_BUCKET_URL}?list-type=2`);
    expect(buildWabaMediaListUrl(undefined)).toBe(`${WABA_MEDIA_BUCKET_URL}?list-type=2`);
  });
});

describe('parseWabaMediaList', () => {
  it('keeps only images for an image header, with the imgproxy thumbnail', () => {
    expect(parseWabaMediaList(xml, 'image')).toEqual([
      {
        key: 'followup/fachada.JPG',
        url: 'https://s3.arqos.online/waba-images/followup/fachada.JPG',
        thumbnailUrl:
          'https://thumbs.arqos.online/insecure/rs:fill:200:200/plain/https://s3.arqos.online/waba-images/followup/fachada.JPG',
        name: 'fachada.JPG',
        isImage: true,
        isVideo: false,
      },
      {
        key: 'followup/sub/piscina.webp',
        url: 'https://s3.arqos.online/waba-images/followup/sub/piscina.webp',
        thumbnailUrl:
          'https://thumbs.arqos.online/insecure/rs:fill:200:200/plain/https://s3.arqos.online/waba-images/followup/sub/piscina.webp',
        name: 'piscina.webp',
        isImage: true,
        isVideo: false,
      },
    ]);
  });

  it('keeps only videos for a video header and decodes XML entities', () => {
    expect(parseWabaMediaList(xml, 'video')).toEqual([
      {
        key: 'followup/tour & planta.mp4',
        url: 'https://s3.arqos.online/waba-images/followup/tour & planta.mp4',
        thumbnailUrl: 'https://s3.arqos.online/waba-images/followup/tour & planta.mp4',
        name: 'tour & planta.mp4',
        isImage: false,
        isVideo: true,
      },
    ]);
  });

  it('returns an empty list for an empty or error response', () => {
    expect(parseWabaMediaList('<ListBucketResult></ListBucketResult>', 'image')).toEqual([]);
    expect(parseWabaMediaList('<Error><Code>AccessDenied</Code></Error>', 'image')).toEqual([]);
  });
});

describe('fetchWabaMedia', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches the listing URL and parses it', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const items = await fetchWabaMedia('followup', 'image');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://s3.arqos.online/waba-images?list-type=2&prefix=followup%2F',
    );
    expect(items.map(i => i.name)).toEqual(['fachada.JPG', 'piscina.webp']);
  });

  it('rejects on an HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;
    await expect(fetchWabaMedia('followup', 'image')).rejects.toThrow('403');
  });
});

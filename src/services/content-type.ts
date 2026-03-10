const extensionToMimeType: Record<string, string> = {
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4'
};

function hasOnlyTextCharacters(content: Uint8Array): boolean {
  for (const byte of content) {
    if (byte === 9 || byte === 10 || byte === 13) {
      continue;
    }

    if (byte < 32 || byte > 126) {
      return false;
    }
  }

  return true;
}

function sniffMimeType(content: Uint8Array): string {
  if (content.length >= 8) {
    const png = [0x89, 0x50, 0x4e, 0x47];
    if (png.every((value, index) => content[index] === value)) {
      return 'image/png';
    }
  }

  if (content.length >= 3) {
    const jpeg = [0xff, 0xd8, 0xff];
    if (jpeg.every((value, index) => content[index] === value)) {
      return 'image/jpeg';
    }
  }

  if (content.length >= 4) {
    const gif87a = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
    const gif89a = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
    if (
      (content.length >= 6 && gif87a.every((value, index) => content[index] === value)) ||
      (content.length >= 6 && gif89a.every((value, index) => content[index] === value))
    ) {
      return 'image/gif';
    }
  }

  if (content.length >= 4) {
    const pdf = [0x25, 0x50, 0x44, 0x46];
    if (pdf.every((value, index) => content[index] === value)) {
      return 'application/pdf';
    }
  }

  const sample = content.subarray(0, Math.min(content.length, 1024));
  if (sample.length > 0 && hasOnlyTextCharacters(sample)) {
    return 'text/plain; charset=utf-8';
  }

  return 'application/octet-stream';
}

function mimeTypeFromFilename(filename: string | null): string | null {
  if (!filename) {
    return null;
  }

  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return null;
  }

  const extension = filename.slice(dotIndex + 1).toLowerCase();
  return extensionToMimeType[extension] ?? null;
}

export function resolveContentType(content: ArrayBuffer, filename: string | null, meta: Record<string, string>): string {
  const fromMeta = meta.contentType ?? meta['content-type'] ?? meta.mimeType;
  if (fromMeta) {
    return fromMeta;
  }

  const fromFilename = mimeTypeFromFilename(filename);
  if (fromFilename) {
    return fromFilename;
  }

  return sniffMimeType(new Uint8Array(content));
}

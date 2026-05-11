export function extractPaymentAuthorizationCredential(authHeader: string | null | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const trimmed = authHeader.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = /^payment\s+(.+)$/i.exec(trimmed);
  if (!match) {
    return null;
  }

  const credential = match[1]?.trim();
  return credential ? credential : null;
}

export function extractIpfsCidFromPath(path: string): string | null {
  const prefix = '/ipfs/';
  if (!path.startsWith(prefix)) {
    return null;
  }

  const cid = path.slice(prefix.length);
  if (cid.length === 0 || cid.includes('/')) {
    return null;
  }

  try {
    return decodeURIComponent(cid);
  } catch {
    return null;
  }
}

export function extractPrivateObjectRenewalIdFromPath(path: string): string | null {
  const prefix = '/private/objects/';
  const suffix = '/renew';
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) {
    return null;
  }

  const objectId = path.slice(prefix.length, -suffix.length);
  if (objectId.length === 0 || objectId.includes('/')) {
    return null;
  }

  try {
    return decodeURIComponent(objectId);
  } catch {
    return null;
  }
}

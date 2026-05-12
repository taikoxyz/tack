import { describe, expect, it } from 'vitest';
import {
  extractIpfsCidFromPath,
  extractPaymentAuthorizationCredential,
  extractPrivateObjectRenewalIdFromPath,
} from '../../../src/services/payment/http';

describe('extractPaymentAuthorizationCredential', () => {
  it('extracts the serialized credential from a Payment auth header', () => {
    expect(extractPaymentAuthorizationCredential('Payment credential-token')).toBe('credential-token');
  });

  it('accepts case-insensitive Payment auth schemes', () => {
    expect(extractPaymentAuthorizationCredential('payment credential-token')).toBe('credential-token');
  });

  it('returns null when the auth header is not Payment', () => {
    expect(extractPaymentAuthorizationCredential('Bearer token')).toBeNull();
  });

  it('returns null when the credential is missing', () => {
    expect(extractPaymentAuthorizationCredential('Payment   ')).toBeNull();
  });
});

describe('extractIpfsCidFromPath', () => {
  it('extracts the CID from the /ipfs/:cid route path', () => {
    expect(extractIpfsCidFromPath('/ipfs/bafy-test-cid')).toBe('bafy-test-cid');
  });

  it('decodes URL-encoded CIDs', () => {
    expect(extractIpfsCidFromPath('/ipfs/bafy%2Ftest')).toBe('bafy/test');
  });

  it('returns null for non-IPFS paths', () => {
    expect(extractIpfsCidFromPath('/pins')).toBeNull();
  });

  it('returns null when the CID segment is empty or contains nested paths', () => {
    expect(extractIpfsCidFromPath('/ipfs/')).toBeNull();
    expect(extractIpfsCidFromPath('/ipfs/bafy-test-cid/extra')).toBeNull();
  });

  it('returns null when the CID segment cannot be URL-decoded', () => {
    expect(extractIpfsCidFromPath('/ipfs/%zz')).toBeNull();
  });
});

describe('extractPrivateObjectRenewalIdFromPath', () => {
  it('extracts the object id from /private/objects/:id/renew', () => {
    expect(extractPrivateObjectRenewalIdFromPath('/private/objects/obj_abc/renew')).toBe('obj_abc');
  });

  it('decodes URL-encoded object ids', () => {
    expect(extractPrivateObjectRenewalIdFromPath('/private/objects/obj%2Fabc/renew')).toBe('obj/abc');
  });

  it('returns null for unrelated paths', () => {
    expect(extractPrivateObjectRenewalIdFromPath('/private/objects/obj_abc')).toBeNull();
    expect(extractPrivateObjectRenewalIdFromPath('/pins')).toBeNull();
  });

  it('returns null for empty or nested ids', () => {
    expect(extractPrivateObjectRenewalIdFromPath('/private/objects//renew')).toBeNull();
    expect(extractPrivateObjectRenewalIdFromPath('/private/objects/a/b/renew')).toBeNull();
  });

  it('returns null instead of throwing on malformed percent-encoding', () => {
    expect(extractPrivateObjectRenewalIdFromPath('/private/objects/%ZZ/renew')).toBeNull();
  });
});

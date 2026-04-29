import { describe, expect, it, vi, afterEach } from 'vitest';
import { IpfsRpcClient } from '../../src/services/ipfs-rpc-client';

describe('IpfsRpcClient.addContent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns hash and size from Kubo response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Name: 'f.txt', Hash: 'bafyhash', Size: '1234' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new IpfsRpcClient('http://ipfs:5001');
    const result = await client.addContent(new Blob(['hello']), 'f.txt');

    expect(result).toEqual({ hash: 'bafyhash', size: 1234 });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns size as 0 if Kubo omits the field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Name: 'f.txt', Hash: 'bafyhash' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new IpfsRpcClient('http://ipfs:5001');
    const result = await client.addContent(new Blob(['hello']), 'f.txt');
    expect(result).toEqual({ hash: 'bafyhash', size: 0 });
  });

  it('returns size as 0 if Kubo returns a non-numeric Size', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Name: 'f.txt', Hash: 'bafyhash', Size: 'not-a-number' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new IpfsRpcClient('http://ipfs:5001');
    const result = await client.addContent(new Blob(['hello']), 'f.txt');
    expect(result).toEqual({ hash: 'bafyhash', size: 0 });
  });

  it('returns size as 0 if Kubo returns a negative Size', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Name: 'f.txt', Hash: 'bafyhash', Size: '-5' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new IpfsRpcClient('http://ipfs:5001');
    const result = await client.addContent(new Blob(['hello']), 'f.txt');
    expect(result).toEqual({ hash: 'bafyhash', size: 0 });
  });
});

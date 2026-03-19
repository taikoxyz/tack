import { Mppx, tempo } from 'mppx/server';

export function createMppInstance(payTo: string, secretKey: string) {
  return Mppx.create({
    secretKey,
    methods: [
      tempo({
        currency: '0x20C000000000000000000000b9537d11c60E8b50', // USDC.e on Tempo mainnet
        recipient: payTo,
      }),
    ],
  });
}

export type MppInstance = ReturnType<typeof createMppInstance>;

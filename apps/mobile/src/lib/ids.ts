import * as Crypto from 'expo-crypto';

export const uuid = (): string => Crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

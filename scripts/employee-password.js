import { scrypt } from '@noble/hashes/scrypt';
import { bytesToHex } from '@noble/hashes/utils';

// Inputs are ASCII SHA-256 digest and UUID salt, so GAS needs no TextEncoder.
export function derive(digest, salt) {
  const bytes = text => Uint8Array.from(text, character => character.charCodeAt(0));
  return bytesToHex(scrypt(bytes(digest), bytes(salt), { N: 32768, r: 8, p: 3, dkLen: 32 }));
}

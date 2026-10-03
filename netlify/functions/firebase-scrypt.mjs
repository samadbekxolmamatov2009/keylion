/* Verifies passwords against Firebase Auth's modified scrypt hashes (from `firebase auth:export`),
   so imported users can keep their passwords. Stored as:
   fbscrypt$memCost$rounds$saltB64$saltSeparatorB64$signerKeyB64$hashB64 */
import crypto from 'node:crypto';

export function verifyFirebaseScrypt(password, stored) {
  const [, memCost, rounds, salt, sep, signerKey, hash] = stored.split('$');
  const N = 2 ** Number(memCost);
  const saltBytes = Buffer.concat([Buffer.from(salt, 'base64'), Buffer.from(sep, 'base64')]);
  const derived = crypto.scryptSync(password, saltBytes, 32, { N, r: Number(rounds), p: 1, maxmem: 256 * N * Number(rounds) });
  const cipher = crypto.createCipheriv('aes-256-ctr', derived, Buffer.alloc(16));
  const out = Buffer.concat([cipher.update(Buffer.from(signerKey, 'base64')), cipher.final()]);
  const want = Buffer.from(hash, 'base64');
  return out.length === want.length && crypto.timingSafeEqual(out, want);
}

export function encodeFirebaseHash({ memCost, rounds, saltSeparator, signerKey }, salt, passwordHash) {
  return ['fbscrypt', memCost, rounds, salt, saltSeparator, signerKey, passwordHash].join('$');
}

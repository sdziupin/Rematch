/**
 * Collision-resistant local ids without a crypto dependency.
 * Hermes does not ship `crypto.getRandomValues`, so `uuid` cannot run there.
 */
let counter = 0;

export function createId(prefix = ''): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return prefix + c.randomUUID();
  counter = (counter + 1) % 1_679_616;
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(4, '0');
  let random = '';
  for (let i = 0; i < 4; i++) random += Math.floor(Math.random() * 0x100000).toString(36).padStart(4, '0');
  return `${prefix}${time}-${seq}-${random}`;
}

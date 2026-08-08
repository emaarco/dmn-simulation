/**
 * Shareable links: encode the current DMN XML into the URL hash so a link opens
 * the exact model. The XML is compressed (`deflate-raw`, browser-native — no CDN,
 * GDPR-friendly) and stored URL-safe Base64 behind `#dmn=`. Idea borrowed from
 * the Miragon Wardley-maps modeler (apps/webapp/src/share.ts).
 */

const HASH_PREFIX = '#dmn='

/** Bytes → URL-safe Base64 (A–Z a–z 0–9 - _, no padding). */
function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64: string): Uint8Array {
  let norm = b64.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm.length % 4
  if (pad) norm += '='.repeat(4 - pad)
  const bin = atob(norm)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(piped).arrayBuffer())
}

/** DMN XML → compressed, URL-safe Base64. */
async function encodeXml(xml: string): Promise<string> {
  const deflated = await pipe(new TextEncoder().encode(xml), new CompressionStream('deflate-raw'))
  return toBase64Url(deflated)
}

/** Compressed, URL-safe Base64 → DMN XML. */
async function decodeXml(encoded: string): Promise<string> {
  const inflated = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'))
  return new TextDecoder().decode(inflated)
}

/** The DMN XML encoded in the current URL hash, or null if there is none. */
export async function readHashXml(): Promise<string | null> {
  const hash = location.hash
  if (!hash.startsWith(HASH_PREFIX)) return null
  try {
    return await decodeXml(hash.slice(HASH_PREFIX.length))
  } catch {
    return null
  }
}

/** A full shareable URL that reopens the given DMN XML. */
export async function buildShareUrl(xml: string): Promise<string> {
  const encoded = await encodeXml(xml)
  return `${location.origin}${location.pathname}${HASH_PREFIX}${encoded}`
}

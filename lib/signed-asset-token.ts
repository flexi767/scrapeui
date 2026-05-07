import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SECONDS = 15 * 60;

function getSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SIGNED_ASSET_SECRET ||
    "scrapeui-dev-signed-assets"
  );
}

function signPayload(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSignedAssetToken(
  id: number,
  ttlSeconds = DEFAULT_TTL_SECONDS,
) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${id}.${expires}`;
  return `${expires}.${signPayload(payload)}`;
}

export function verifySignedAssetToken(id: number, token: string | null) {
  if (!token) return false;
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!expires || !signature || expires < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = signPayload(`${id}.${expires}`);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

export function appendSignedAssetToken(path: string, id: number) {
  return `${path}${path.includes("?") ? "&" : "?"}t=${createSignedAssetToken(id)}`;
}

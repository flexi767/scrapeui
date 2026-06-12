const target = process.env.IMAGE_AUDIT_URL;

if (!target) {
  console.error("Set IMAGE_AUDIT_URL to an image route URL, for example http://localhost:3000/api/images/foo.webp");
  process.exit(1);
}

const response = await fetch(target, { method: "GET", cache: "no-store" });
const cacheControl = response.headers.get("cache-control") ?? "";
const contentType = response.headers.get("content-type") ?? "";
const contentLength = response.headers.get("content-length") ?? "";

console.log(`URL: ${target}`);
console.log(`Status: ${response.status}`);
console.log(`Content-Type: ${contentType || "(missing)"}`);
console.log(`Content-Length: ${contentLength || "(missing)"}`);
console.log(`Cache-Control: ${cacheControl || "(missing)"}`);

const failures: string[] = [];
if (!response.ok) failures.push(`expected 2xx response, got ${response.status}`);
if (!contentType.startsWith("image/")) failures.push("content-type is not image/*");
if (!cacheControl) failures.push("cache-control header is missing");
if (/no-store|no-cache/i.test(cacheControl)) failures.push("image route is not cacheable");

if (failures.length > 0) {
  console.error(`\nImage cache audit failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("\nImage cache audit passed.");

export {};

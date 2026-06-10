This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Instagram poster image providers

The Instagram poster API supports OpenAI by default and ComfyUI for self-hosted image generation.

OpenAI:

```bash
OPENAI_API_KEY=...
INSTAGRAM_POSTER_IMAGE_PROVIDER=openai
INSTAGRAM_POSTER_IMAGE_MODEL=gpt-image-2
```

ComfyUI:

```bash
INSTAGRAM_POSTER_IMAGE_PROVIDER=comfyui
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_WORKFLOW_PATH=workflows/instagram-poster-flux.json
COMFYUI_TIMEOUT_MS=180000
```

OpenAI remains the UI default. The poster screen also has an image API selector, so you can switch between OpenAI and ComfyUI per generation.

`COMFYUI_WORKFLOW_PATH` must point to a ComfyUI API-format workflow JSON, not the UI-format workflow. ScrapeUI queues it through `/prompt`, polls `/history/{prompt_id}`, and reads the first output image unless `COMFYUI_OUTPUT_NODE_ID` is set.

To expose multiple ComfyUI model choices in the UI, configure `COMFYUI_MODELS` as JSON. Each ComfyUI model can point at a different API-format workflow:

```bash
COMFYUI_MODELS='[
  {"id":"flux-dev","label":"FLUX.1 dev","workflowPath":"workflows/instagram-flux-dev.json"},
  {"id":"flux-schnell","label":"FLUX.1 schnell","workflowPath":"workflows/instagram-flux-schnell.json"}
]'
```

There are two ways to pass prompt/reference data into the workflow:

- Set placeholders in the workflow JSON: `{{PROMPT}}`, `{{POSITIVE_PROMPT}}`, `{{REFERENCE_IMAGE_1}}`, `{{REFERENCE_IMAGE_2}}`, etc.
- Or set explicit node IDs:

```bash
COMFYUI_POSITIVE_PROMPT_NODE_ID=6
COMFYUI_POSITIVE_PROMPT_INPUT=text
COMFYUI_REFERENCE_IMAGE_NODE_IDS=14,15,16,17
COMFYUI_REFERENCE_IMAGE_INPUT=image
COMFYUI_OUTPUT_NODE_ID=9
```

Reference images are uploaded to ComfyUI with `/upload/image` before each generation. Keep OpenAI configured as a fallback while tuning the ComfyUI workflow; the UI already falls back to local canvas posters if the image API fails.

## Architecture notes

### ORM usage

Drizzle is used as a schema definition and TypeScript type-generation layer only. Business-logic queries are hand-written SQL executed via the better-sqlite3 `raw` client. Do not expect ORM-level query-builder safety; always validate identifier and input parameters yourself before constructing SQL.

### Single-node runtime constraint

Scraper and automation jobs are spawned as in-process child processes with run-state held in memory (`lib/api/child-stream.ts`). The app runs as a single node and is **not safe for horizontal scaling**—job state and "already running" guards are per-process, and SQLite enforces single-writer constraints. To support multiple server instances, job state and job queue would need to move to the database, and long-running jobs would need to be decoupled into separate worker processes.

### Required environment variables

- **`CREDENTIALS_ENCRYPTION_KEY`** (64 hex chars, REQUIRED in production): Encrypts dealer third-party credentials at rest. Must be identical across all environments; if different values are used, decryption will fail and the app will not start.
- **`ALLOW_DEV_LOGIN`** (required alongside `NODE_ENV=development`): Enables the `__dev_auto__` development-only login mode.
- **Optional**: `LM_STUDIO_URL`, `OPENAI_API_KEY`, `OPENAI_FALLBACK_MODEL` (used by chat route for LLM fallback image generation)

import {
  formatPosterMileage,
  formatPosterPrice,
  type InstagramListingPayload,
  type PosterVariantPrompt,
} from "../poster";
import type {
  PosterImageModelOption,
  PosterImageProviderId,
  PosterImageProviderOption,
} from "../useInstagramPosterWorkflow";
import { StepHeader } from "./shared";

interface PosterPromptPanelProps {
  prompt: string;
  listing: InstagramListingPayload;
  variantPrompts: PosterVariantPrompt[];
  imageProvider: PosterImageProviderId;
  imageModel: string;
  imageProviderOptions: PosterImageProviderOption[];
  imageModelOptions: PosterImageModelOption[];
  onPromptChange: (prompt: string) => void;
  onVariantPromptChange: (id: string, prompt: string) => void;
  onImageProviderChange: (provider: PosterImageProviderId) => void;
  onImageModelChange: (model: string) => void;
  onSaveDefaultsForFuture: () => void;
  onReset: () => void;
}

export function PosterPromptPanel({
  prompt,
  listing,
  variantPrompts,
  imageProvider,
  imageModel,
  imageProviderOptions,
  imageModelOptions,
  onPromptChange,
  onVariantPromptChange,
  onImageProviderChange,
  onImageModelChange,
  onSaveDefaultsForFuture,
  onReset,
}: PosterPromptPanelProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <StepHeader
          step="Step 1"
          title="Set the style"
          detail="This main prompt controls the overall look of the cover and collage pages."
        />
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onSaveDefaultsForFuture}
            className="inline-flex h-8 items-center rounded-md border border-pink-500/60 px-3 text-xs text-pink-100 hover:bg-pink-500/10"
          >
            Save default
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-8 items-center rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800"
          >
            Reset
          </button>
        </div>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        rows={10}
        className="w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-sm leading-6 text-gray-200 outline-none focus:border-pink-400"
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Image API</span>
          <select
            value={imageProvider}
            onChange={(event) => onImageProviderChange(event.target.value as PosterImageProviderId)}
            className="mt-1 h-10 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-gray-100 outline-none focus:border-pink-400"
          >
            {imageProviderOptions.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {imageProvider === "comfyui" ? "ComfyUI model" : "OpenAI model"}
          </span>
          <select
            value={imageModel}
            onChange={(event) => onImageModelChange(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-gray-100 outline-none focus:border-pink-400"
          >
            {imageModelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="mt-4 rounded-md border border-gray-800 bg-gray-950 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-white marker:text-gray-500">
          Post data
        </summary>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-500">Make</div>
            <div className="text-gray-100">{listing.make ?? "-"}</div>
          </div>
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-500">Model</div>
            <div className="text-gray-100">{listing.model ?? "-"}</div>
          </div>
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-500">Mileage</div>
            <div className="text-gray-100">{formatPosterMileage(listing.mileage)}</div>
          </div>
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-500">Price</div>
            <div className="text-gray-100">{formatPosterPrice(listing.price)}</div>
          </div>
        </div>
        <textarea
          value={listing.caption}
          readOnly
          rows={8}
          className="mt-3 w-full resize-y rounded-md border border-gray-800 bg-gray-900 p-3 text-sm leading-6 text-gray-200"
        />
      </details>

      <details className="mt-4 rounded-md border border-gray-800 bg-gray-950 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-white marker:text-gray-500">
          Advanced variant prompts
        </summary>
        <div className="mt-1 text-xs text-gray-500">
          Fine-tune each generated page only when the default flow is not enough.
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {variantPrompts.map((variant) => (
            <label key={variant.id} className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{variant.name}</span>
              <textarea
                value={variant.prompt}
                onChange={(event) => onVariantPromptChange(variant.id, event.target.value)}
                rows={5}
                className="mt-1 w-full resize-y rounded-md border border-gray-700 bg-gray-900 p-3 text-xs leading-5 text-gray-200 outline-none focus:border-pink-400"
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

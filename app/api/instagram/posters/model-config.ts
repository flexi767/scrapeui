export type PosterImageProvider = "openai" | "comfyui";

export interface PosterImageModelOption {
  id: string;
  label: string;
}

export interface PosterImageModelConfig extends PosterImageModelOption {
  workflowPath?: string;
}

export function getPosterImageProvider(rawProvider = process.env.INSTAGRAM_POSTER_IMAGE_PROVIDER): PosterImageProvider {
  const provider = rawProvider?.trim().toLowerCase();
  if (provider === "comfy" || provider === "comfyui") return "comfyui";
  return "openai";
}

function parseModelList(rawValue: string | undefined, fallback: PosterImageModelConfig[]) {
  if (!rawValue?.trim()) return fallback;
  const trimmed = rawValue.trim();
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as Array<Partial<PosterImageModelConfig> | string>;
    const models = parsed
      .map((item) => {
        if (typeof item === "string") return { id: item, label: item };
        if (!item.id) return null;
        return {
          id: item.id,
          label: item.label || item.id,
          workflowPath: item.workflowPath,
        };
      })
      .filter((item): item is PosterImageModelConfig => Boolean(item));
    return models.length > 0 ? models : fallback;
  }
  const models = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => ({ id, label: id }));
  return models.length > 0 ? models : fallback;
}

function getOpenAiModelOptions() {
  return parseModelList(process.env.INSTAGRAM_POSTER_OPENAI_MODELS, [
    { id: process.env.INSTAGRAM_POSTER_IMAGE_MODEL ?? "gpt-image-2", label: process.env.INSTAGRAM_POSTER_IMAGE_MODEL ?? "gpt-image-2" },
  ]);
}

function getComfyModelOptions() {
  return parseModelList(process.env.COMFYUI_MODELS, [
    {
      id: process.env.INSTAGRAM_POSTER_IMAGE_MODEL ?? "default",
      label: process.env.INSTAGRAM_POSTER_IMAGE_MODEL ?? "Default ComfyUI workflow",
      workflowPath: process.env.COMFYUI_WORKFLOW_PATH,
    },
  ]);
}

export function getPosterImageModelOptions(provider: PosterImageProvider): PosterImageModelOption[] {
  const models = provider === "comfyui" ? getComfyModelOptions() : getOpenAiModelOptions();
  return models.map(({ id, label }) => ({ id, label }));
}

function getPosterImageModelConfig(provider: PosterImageProvider, modelId: string | null): PosterImageModelConfig {
  const models = provider === "comfyui" ? getComfyModelOptions() : getOpenAiModelOptions();
  const defaultModel = models[0];
  const selected = modelId ? models.find((model) => model.id === modelId) : defaultModel;
  if (!selected) throw new Error(`Invalid ${provider === "comfyui" ? "ComfyUI" : "OpenAI"} image model`);
  return selected;
}

export function getPosterImageProviderOptions() {
  const defaultProvider = getPosterImageProvider();
  return {
    defaultProvider,
    providers: [
      {
        id: "openai" as const,
        label: "OpenAI",
        defaultModel: getPosterImageModelConfig("openai", null).id,
        models: getPosterImageModelOptions("openai"),
      },
      {
        id: "comfyui" as const,
        label: "ComfyUI",
        defaultModel: getPosterImageModelConfig("comfyui", null).id,
        models: getPosterImageModelOptions("comfyui"),
      },
    ],
  };
}

export function resolvePosterImageModel(provider: PosterImageProvider, modelId: string | null) {
  return getPosterImageModelConfig(provider, modelId);
}

export function validatePosterImageProvider(provider: PosterImageProvider, modelId: string | null) {
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    return "OPENAI_API_KEY is not configured";
  }
  try {
    const model = getPosterImageModelConfig(provider, modelId);
    if (provider === "comfyui" && !model.workflowPath && !process.env.COMFYUI_WORKFLOW_PATH) {
      return "COMFYUI_WORKFLOW_PATH is not configured";
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid image model";
  }
  return null;
}

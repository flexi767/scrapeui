export type PosterImageProvider = "openai" | "comfy-local" | "comfy-api";

export interface PosterImageModelOption {
  id: string;
  label: string;
}

export interface PosterImageModelConfig extends PosterImageModelOption {
  workflowPath?: string;
}

export function getPosterImageProvider(rawProvider = process.env.INSTAGRAM_POSTER_IMAGE_PROVIDER): PosterImageProvider {
  const provider = rawProvider?.trim().toLowerCase();
  if (provider === "comfy-api" || provider === "comfyui-api" || provider === "api-comfy") return "comfy-api";
  if (provider === "comfy" || provider === "comfyui" || provider === "comfy-local" || provider === "local-comfy") return "comfy-local";
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

function getComfyModelOptions(provider: Extract<PosterImageProvider, "comfy-local" | "comfy-api">) {
  const isApi = provider === "comfy-api";
  const modelEnv = isApi
    ? process.env.COMFYUI_API_MODELS ?? process.env.COMFYUI_MODELS
    : process.env.COMFYUI_LOCAL_MODELS ?? process.env.COMFYUI_MODELS;
  const workflowPath = isApi
    ? process.env.COMFYUI_API_WORKFLOW_PATH ?? process.env.COMFYUI_WORKFLOW_PATH
    : process.env.COMFYUI_LOCAL_WORKFLOW_PATH ?? process.env.COMFYUI_WORKFLOW_PATH;

  return parseModelList(modelEnv, [
    {
      id: process.env.INSTAGRAM_POSTER_IMAGE_MODEL ?? "default",
      label: process.env.INSTAGRAM_POSTER_IMAGE_MODEL ?? (isApi ? "Default ComfyUI API workflow" : "Default local ComfyUI workflow"),
      workflowPath,
    },
  ]);
}

export function getPosterImageModelOptions(provider: PosterImageProvider): PosterImageModelOption[] {
  const models = provider === "openai" ? getOpenAiModelOptions() : getComfyModelOptions(provider);
  return models.map(({ id, label }) => ({ id, label }));
}

function getPosterImageModelConfig(provider: PosterImageProvider, modelId: string | null): PosterImageModelConfig {
  const models = provider === "openai" ? getOpenAiModelOptions() : getComfyModelOptions(provider);
  const defaultModel = models[0];
  const selected = modelId ? models.find((model) => model.id === modelId) : defaultModel;
  if (!selected) throw new Error(`Invalid ${provider === "openai" ? "OpenAI" : "ComfyUI"} image model`);
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
        id: "comfy-local" as const,
        label: "ComfyUI Local",
        defaultModel: getPosterImageModelConfig("comfy-local", null).id,
        models: getPosterImageModelOptions("comfy-local"),
      },
      {
        id: "comfy-api" as const,
        label: "ComfyUI API",
        defaultModel: getPosterImageModelConfig("comfy-api", null).id,
        models: getPosterImageModelOptions("comfy-api"),
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
  if (provider === "comfy-api" && !process.env.COMFYUI_API_BASE_URL) {
    return "COMFYUI_API_BASE_URL is not configured";
  }
  try {
    const model = getPosterImageModelConfig(provider, modelId);
    if (provider === "comfy-local") {
      const workflowPath = model.workflowPath ?? process.env.COMFYUI_LOCAL_WORKFLOW_PATH ?? process.env.COMFYUI_WORKFLOW_PATH;
      if (!workflowPath) return "COMFYUI_LOCAL_WORKFLOW_PATH or COMFYUI_WORKFLOW_PATH is not configured";
    }
    if (provider === "comfy-api") {
      const workflowPath = model.workflowPath ?? process.env.COMFYUI_API_WORKFLOW_PATH ?? process.env.COMFYUI_WORKFLOW_PATH;
      if (!workflowPath) return "COMFYUI_API_WORKFLOW_PATH or COMFYUI_WORKFLOW_PATH is not configured";
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid image model";
  }
  return null;
}

import type { AiProviderConfig } from './types.js';
import { streamClaude } from './claude.js';
import { streamCodex } from './codex.js';

export interface AiStreamHandlers {
  onDelta: (text: string) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
}

export interface AiStreamOptions {
  cwd?: string;
  allowRepoRead?: boolean;
  model?: string;
}

export type AiProviderStream = (
  prompt: string,
  handlers: AiStreamHandlers,
  opts?: AiStreamOptions,
) => () => void;

export interface AiProviderAdapters {
  claude: AiProviderStream;
  codex?: AiProviderStream;
}

export const defaultAiProviderAdapters: AiProviderAdapters = {
  claude: streamClaude,
  codex: streamCodex,
};

export function selectedModel(config: AiProviderConfig): string | undefined {
  return config.provider === 'codex' ? config.codex_model : config.claude_model;
}

export function streamAiProvider(
  prompt: string,
  config: AiProviderConfig,
  handlers: AiStreamHandlers,
  adapters: AiProviderAdapters,
  opts?: Omit<AiStreamOptions, 'model'>,
): () => void {
  const model = selectedModel(config);
  const streamOpts: AiStreamOptions | undefined = model
    ? { ...(opts ?? {}), model }
    : opts;
  if (config.provider === 'claude') {
    return adapters.claude(prompt, handlers, streamOpts);
  }
  if (!adapters.codex) {
    handlers.onError('Codex provider is not available');
    return () => {};
  }
  return adapters.codex(prompt, handlers, streamOpts);
}

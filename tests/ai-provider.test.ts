import {
  defaultAiProviderAdapters,
  selectedModel,
  streamAiProvider,
  type AiProviderAdapters,
} from '../src/ai-provider';
import type { AiProviderConfig } from '../src/types';

const config = (overrides: Partial<AiProviderConfig> = {}): AiProviderConfig => ({
  provider: 'claude',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('selectedModel', () => {
  it('selects the active provider model only', () => {
    expect(selectedModel(config({
      provider: 'claude',
      claude_model: 'sonnet',
      codex_model: 'gpt-5-codex',
    }))).toBe('sonnet');
    expect(selectedModel(config({
      provider: 'codex',
      claude_model: 'sonnet',
      codex_model: 'gpt-5-codex',
    }))).toBe('gpt-5-codex');
  });

  it('returns undefined when the active provider has no model override', () => {
    expect(selectedModel(config({ provider: 'codex', claude_model: 'sonnet' }))).toBeUndefined();
  });
});

describe('streamAiProvider', () => {
  const handlers = {
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches Claude streams with provider-neutral options and active model', () => {
    const cancel = vi.fn();
    const adapters: AiProviderAdapters = {
      claude: vi.fn().mockReturnValue(cancel),
    };
    const returned = streamAiProvider(
      'prompt',
      config({ provider: 'claude', claude_model: 'sonnet', codex_model: 'gpt-5-codex' }),
      handlers,
      adapters,
      { cwd: '/repo', allowRepoRead: true },
    );
    expect(returned).toBe(cancel);
    expect(adapters.claude).toHaveBeenCalledWith(
      'prompt',
      handlers,
      { cwd: '/repo', allowRepoRead: true, model: 'sonnet' },
    );
  });

  it('dispatches Codex streams with the Codex model', () => {
    const adapters: AiProviderAdapters = {
      claude: vi.fn(),
      codex: vi.fn().mockReturnValue(() => {}),
    };
    streamAiProvider(
      'prompt',
      config({ provider: 'codex', claude_model: 'sonnet', codex_model: 'gpt-5-codex' }),
      handlers,
      adapters,
    );
    expect(adapters.codex).toHaveBeenCalledWith(
      'prompt',
      handlers,
      { model: 'gpt-5-codex' },
    );
    expect(adapters.claude).not.toHaveBeenCalled();
  });

  it('surfaces a clear error when Codex is configured but unavailable', () => {
    const cancel = streamAiProvider(
      'prompt',
      config({ provider: 'codex' }),
      handlers,
      { claude: vi.fn() },
    );
    expect(handlers.onError).toHaveBeenCalledWith('Codex provider is not available');
    expect(cancel).toEqual(expect.any(Function));
  });
});

describe('defaultAiProviderAdapters', () => {
  it('provides the Claude adapter by default', () => {
    expect(defaultAiProviderAdapters.claude).toEqual(expect.any(Function));
  });
});

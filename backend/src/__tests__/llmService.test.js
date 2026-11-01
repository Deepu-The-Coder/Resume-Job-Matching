import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('llmService Gemini integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends system and user content to Gemini and returns text plus usage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'A concise explanation.' }] } }],
        usageMetadata: {
          promptTokenCount: 18,
          candidatesTokenCount: 7,
        },
      }),
    });

    const { generate } = await import('../services/llmService.js');
    const result = await generate({ system: 'System rules', user: 'Retrieved facts' });
    const [url, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(String(url)).toContain('generativelanguage.googleapis.com/v1beta/models/');
    expect(String(url)).toContain(':generateContent');
    expect(body.systemInstruction.parts[0].text).toBe('System rules');
    expect(body.contents[0].parts[0].text).toBe('Retrieved facts');
    expect(result).toEqual({
      text: 'A concise explanation.',
      usage: { inputTokens: 18, outputTokens: 7 },
    });
  });
});

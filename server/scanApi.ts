import Anthropic from '@anthropic-ai/sdk';
import type { ScanRequest, ScanResponse } from '../src/lib/types.ts';
import { SYSTEM, ScanError, instructionFor, sanitize, scanSchema } from './scanShared.ts';

const MODEL = 'claude-opus-5';

let client: Anthropic | null = null;

/** Scan with the Anthropic API (pay-as-you-go key in ANTHROPIC_API_KEY). */
export async function scanWithApi(req: ScanRequest): Promise<ScanResponse> {
  client ??= new Anthropic();

  const instruction = instructionFor(req.kind);

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: scanSchema } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: req.mediaType, data: req.data } },
            { type: 'text', text: instruction },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ScanError('The scanner isn’t set up yet — add ANTHROPIC_API_KEY (to .env locally, or the site’s environment variables when hosted).', 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ScanError('Too many scans at once. Try again in a moment.', 429);
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new ScanError('That image couldn’t be read. Try a clearer photo.', 400);
    }
    if (error instanceof Anthropic.APIError) {
      throw new ScanError('The scanner is having trouble right now.', 502);
    }
    if (error instanceof Error && /api key|apiKey|authToken/i.test(error.message)) {
      // Thrown by the SDK constructor path when no credentials are configured.
      throw new ScanError('The scanner isn’t set up yet — add ANTHROPIC_API_KEY (to .env locally, or the site’s environment variables when hosted).', 503);
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') {
    throw new ScanError('We couldn’t read that image.', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ScanError('That receipt is too long to read in one go. Try photographing half at a time.', 422);
  }

  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ScanError('We couldn’t make sense of that image.', 502);
  }
  return { items: sanitize(parsed) };
}

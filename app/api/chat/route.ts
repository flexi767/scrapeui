import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';

const LM_STUDIO_URL = process.env.LM_STUDIO_URL ?? 'http://localhost:1234/v1/chat/completions';
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL ?? 'gpt-4o';

type ChatMessage = { role: string; content: string };

function isAnthropicModel(model: string | undefined): boolean {
  if (!model) return false;
  return /claude|anthropic/i.test(model);
}

function isRateLimitFailure(status: number, bodyText: string): boolean {
  if (status === 429) return true;
  return /(rate.?limit|too many requests|quota)/i.test(bodyText);
}

function buildAuthHeaders(isLocal: boolean): Record<string, string> {
  if (isLocal || !process.env.OPENAI_API_KEY) return {};
  return { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
}

function streamResponse(upstream: Response): Response {
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(req: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { messages, model } = await req.json();

  // Check if the last user message starts with "local:"
  const lastUserMessage = [...messages].reverse().find((m: ChatMessage) => m.role === 'user');
  const isLocal = lastUserMessage?.content?.trimStart().startsWith('local:');

  // Strip the "local:" prefix from the message
  const cleanedMessages = messages.map((m: ChatMessage) => {
    if (m === lastUserMessage && isLocal) {
      return { ...m, content: m.content.trimStart().slice('local:'.length).trimStart() };
    }
    return m;
  });

  const targetUrl = LM_STUDIO_URL;
  const targetModel = model ?? (isLocal ? undefined : 'gpt-4o');

  const body: Record<string, unknown> = {
    messages: cleanedMessages,
    stream: true,
  };
  if (targetModel) body.model = targetModel;

  let upstream = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(isLocal),
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const primaryErrorText = await upstream.text();
    const shouldFallbackToOpenAI =
      !isLocal &&
      isAnthropicModel(targetModel) &&
      targetModel !== OPENAI_FALLBACK_MODEL &&
      isRateLimitFailure(upstream.status, primaryErrorText);

    if (shouldFallbackToOpenAI) {
      const fallbackBody: Record<string, unknown> = {
        ...body,
        model: OPENAI_FALLBACK_MODEL,
      };

      upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(false),
        },
        body: JSON.stringify(fallbackBody),
      });

      if (upstream.ok) return streamResponse(upstream);

      const fallbackErrorText = await upstream.text();
      return new Response(
        JSON.stringify({
          error: fallbackErrorText,
          fallbackAttempted: true,
          primaryModel: targetModel,
          fallbackModel: OPENAI_FALLBACK_MODEL,
        }),
        {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: primaryErrorText,
        fallbackAttempted: false,
      }),
      {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return streamResponse(upstream);
}

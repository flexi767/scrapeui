import { NextRequest } from 'next/server';

const LM_STUDIO_URL = process.env.LM_STUDIO_URL ?? 'http://10.210.232.53:1234/v1/chat/completions';

export async function POST(req: NextRequest) {
  const { messages, model } = await req.json();

  // Check if the last user message starts with "local:"
  const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
  const isLocal = lastUserMessage?.content?.trimStart().startsWith('local:');

  // Strip the "local:" prefix from the message
  const cleanedMessages = messages.map((m: { role: string; content: string }) => {
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

  const upstream = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.OPENAI_API_KEY && !isLocal
        ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
        : {}),
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(JSON.stringify({ error: text }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

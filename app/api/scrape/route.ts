import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { dealers, deepCrawl } = await req.json();

  const scriptArgs = ['--dealers', (dealers as string[]).join(',')];
  if (deepCrawl) scriptArgs.push('--deep');

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (data: object) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const child = spawn('node', [
        '/Users/v/dev/scrapers/scripts/run-for-ui.js',
        ...scriptArgs,
      ]);

      let buffer = '';

      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            send(obj);
          } catch {
            // ignore non-JSON stdout lines (crawlee internal logs, etc.)
          }
        }
      });

      // Silently discard stderr (crawlee debug noise)
      child.stderr.on('data', () => {});

      child.on('close', (code: number | null) => {
        send({ type: 'complete', code });
        controller.close();
      });

      child.on('error', (err: Error) => {
        send({ type: 'error', message: err.message });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

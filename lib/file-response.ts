import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import path from 'path';

export function isPathInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(resolvedRoot + path.sep)
  );
}

export async function streamFileResponse(
  filePath: string,
  {
    contentType,
    headers = {},
  }: {
    contentType: string;
    headers?: HeadersInit;
  },
): Promise<Response> {
  const fileStat = await stat(filePath).catch(() => null);

  if (!fileStat?.isFile()) {
    return new Response('Not found', { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new Response(stream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileStat.size),
      ...headers,
    },
  });
}

import { NextResponse } from 'next/server';
import { mastra } from '@/mastra';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = body?.prompt ?? '';
    const threadId: string = body?.threadId ?? 'anon';
    const resourceId: string = body?.resourceId ?? 'mapmyhealth';

    const agent = mastra.getAgent('healthAgent');
    // Stream will be created with retry inside the ReadableStream start()

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
          const isRetryableError = (err: any) => {
            const message = String(err?.message ?? err ?? '').toLowerCase();
            const statusCode = (err as any)?.statusCode ?? (err as any)?.status;
            const isRetryable = (err as any)?.isRetryable === true;
            return (
              isRetryable ||
              statusCode === 429 ||
              statusCode === 503 ||
              message.includes('overloaded') ||
              message.includes('unavailable') ||
              message.includes('rate limit')
            );
          };

          const createStreamWithRetry = async () => {
            const maxAttempts = 4;
            const baseDelayMs = 750;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                if (attempt > 1) {
                  const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 2) + Math.random() * 200);
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'breadcrumb', data: { phase: 'retry', attempt, delayMs: delay } }) + '\n'));
                  await sleep(delay);
                }
                const s = await agent.streamVNext(prompt, {
                  memory: { thread: threadId, resource: resourceId },
                  onChunk: () => {},
                });
                if (attempt > 1) {
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'breadcrumb', data: { phase: 'retry-success', attempt } }) + '\n'));
                }
                return s;
              } catch (err: any) {
                if (attempt < maxAttempts && isRetryableError(err)) {
                  continue;
                }
                throw err;
              }
            }
            throw new Error('Failed to create model stream after retries');
          };

          // Create model stream with retries before sending any text
          let stream = await createStreamWithRetry();
          let hasSentText = false;

          // Tool-call breadcrumbs: consume full stream and emit small JSON events
          try {
            for await (const chunk of stream.fullStream) {
              try {
                if (chunk.type === 'text-delta') {
                  hasSentText = true;
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', data: chunk.payload.text }) + '\n'));
                }
                if (chunk.type === 'tool-call') {
                  const toolName = (chunk as any)?.payload?.toolName;
                  const args = (chunk as any)?.payload?.args;
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'breadcrumb', data: { phase: 'tool-call', toolName } }) + '\n'));
                  // forward tool intent so client can mirror local state
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'tool', data: { toolName, args } }) + '\n'));
                }
                if (chunk.type === 'tool-result') {
                  const toolName = (chunk as any)?.payload?.toolName;
                  const result = (chunk as any)?.payload?.result;
                  const args = (chunk as any)?.payload?.args;
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'breadcrumb', data: { phase: 'tool-result', toolName } }) + '\n'));
                  // Forward tool result so client can reconcile local state
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'tool-result', data: { toolName, args, result } }) + '\n'));
                  // Forward UI payloads (e.g., mermaid, condition/action cards)
                  if (result && typeof result === 'object' && result.ui) {
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'ui', data: result }) + '\n'));
                  }
                  // Avoid importing client store here; let client rehydrate after tool-result
                }
              } catch (chunkErr: any) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', data: `stream-chunk: ${String(chunkErr?.message ?? chunkErr)}` }) + '\n'));
                // continue loop without failing the whole stream
              }
            }
          } catch (readErr: any) {
            // If the stream fails before any text was sent, attempt one more retry cycle
            if (!hasSentText && isRetryableError(readErr)) {
              try {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'breadcrumb', data: { phase: 'retry-read' } }) + '\n'));
                stream = await createStreamWithRetry();
                for await (const chunk of stream.fullStream) {
                  try {
                    if (chunk.type === 'text-delta') {
                      hasSentText = true;
                      controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', data: chunk.payload.text }) + '\n'));
                    }
                    if (chunk.type === 'tool-call') {
                      const toolName = (chunk as any)?.payload?.toolName;
                      const args = (chunk as any)?.payload?.args;
                      controller.enqueue(encoder.encode(JSON.stringify({ type: 'breadcrumb', data: { phase: 'tool-call', toolName } }) + '\n'));
                      controller.enqueue(encoder.encode(JSON.stringify({ type: 'tool', data: { toolName, args } }) + '\n'));
                    }
                    if (chunk.type === 'tool-result') {
                      const toolName = (chunk as any)?.payload?.toolName;
                      const result = (chunk as any)?.payload?.result;
                      const args = (chunk as any)?.payload?.args;
                      controller.enqueue(encoder.encode(JSON.stringify({ type: 'breadcrumb', data: { phase: 'tool-result', toolName } }) + '\n'));
                      controller.enqueue(encoder.encode(JSON.stringify({ type: 'tool-result', data: { toolName, args, result } }) + '\n'));
                      if (result && typeof result === 'object' && result.ui) {
                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'ui', data: result }) + '\n'));
                      }
                    }
                  } catch (chunkErr2: any) {
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', data: `stream-chunk: ${String(chunkErr2?.message ?? chunkErr2)}` }) + '\n'));
                  }
                }
              } catch (finalErr: any) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', data: String(finalErr?.message ?? finalErr) }) + '\n'));
              }
            } else {
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', data: String(readErr?.message ?? readErr) }) + '\n'));
            }
          }

          const finalText = await stream.text;
          if (finalText) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', data: finalText }) + '\n'));
          }
        } catch (err: any) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', data: String(err?.message ?? err) }) + '\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}



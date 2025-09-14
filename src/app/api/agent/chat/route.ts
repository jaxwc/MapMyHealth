import { NextResponse } from 'next/server';
import { mastra } from '@/mastra';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = body?.prompt ?? '';
    const threadId: string = body?.threadId ?? 'anon';
    const resourceId: string = body?.resourceId ?? 'mapmyhealth';

    const agent = mastra.getAgent('healthAgent');

    const stream = await agent.streamVNext(prompt, {
      memory: { thread: threadId, resource: resourceId },
      onChunk: () => {},
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Tool-call breadcrumbs: consume full stream and emit small JSON events
          for await (const chunk of stream.fullStream) {
            if (chunk.type === 'text-delta') {
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



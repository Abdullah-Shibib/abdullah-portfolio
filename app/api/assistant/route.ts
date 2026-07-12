import Anthropic from '@anthropic-ai/sdk';
import { buildAssistantSystemPrompt } from '@/lib/assistant';

/* ------------------------------------------------------------------ */
/*  AXIS live-LLM path — used only when ANTHROPIC_API_KEY is set.      */
/*  Streams plain text chunks; the client renders them as they land.  */
/*  Without a key this returns 503 and the client falls back to the   */
/*  local retrieval engine in lib/assistant.ts, so the assistant       */
/*  always works — the key just makes it smarter.                     */
/* ------------------------------------------------------------------ */

export const runtime = 'nodejs';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ fallback: true }, { status: 503 });
  }

  let turns: ChatTurn[];
  try {
    const body = await req.json();
    turns = (Array.isArray(body?.messages) ? body.messages : [])
      .filter(
        (m: any): m is ChatTurn =>
          (m?.role === 'user' || m?.role === 'assistant') &&
          typeof m?.content === 'string' &&
          m.content.length > 0,
      )
      .slice(-16) // context awareness without unbounded prompts
      .map((m: ChatTurn) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user') {
    return Response.json({ error: 'last message must be from the user' }, { status: 400 });
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const msgStream = client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: buildAssistantSystemPrompt(),
              // the grounding dossier is identical across visitors — cache it
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: turns,
        });
        msgStream.on('text', (delta) => controller.enqueue(encoder.encode(delta)));
        await msgStream.finalMessage();
        controller.close();
      } catch (err) {
        // surface a terminal-flavored failure; the client keeps the session alive
        controller.enqueue(
          encoder.encode('\n[LINK DEGRADED — uplink to the language core failed. Try again.]'),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

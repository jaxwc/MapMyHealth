"use client";

import { useState, FormEvent, useRef, useEffect } from 'react';
import { useHealthStore } from '@/app/state/healthStore';
// Remove unused import - ChatPanel will work with store directly
import { SendHorizonal } from 'lucide-react';
import { Button } from './ui/button';
import { HealthChip } from '@/components/health/HealthChip';
import { ConditionCard } from '@/components/health/ConditionCard';
import { ActionCard } from '@/components/health/ActionCard';
import { MermaidDiagram } from '@/components/health/MermaidDiagram';
import { useHealthStore as useStore } from '@/app/state/healthStore';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface Message {
  sender: "user" | "ai";
  text: string;
  jsx?: React.ReactNode;
  kind?: 'breadcrumb' | 'normal';
}

interface ChatPanelProps {
  // No props needed - ChatPanel uses store directly now
}

const TypingIndicator = () => (
  <div className="flex items-center space-x-1.5 p-3">
    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
  </div>
);

export default function ChatPanel({}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "ai", text: "Hello! I am your health assistant. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamMsgIndexRef = useRef<number | null>(null);

  // Server-authoritative sync helpers
  const replaceAll = useHealthStore(state => (state as any).replaceAll);
  const stateVersion = useHealthStore((state: any) => state.stateVersion);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentInput }),
      });

      if (!response.ok || !response.body) {
        throw new Error("API request failed");
      }

      // Stream JSONL lines: {type: 'text'|'breadcrumb'|'done'|'error', data}
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aggregated = '';

      const pushAIText = (text: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          if (streamMsgIndexRef.current != null && updated[streamMsgIndexRef.current]) {
            updated[streamMsgIndexRef.current] = { sender: 'ai', text: `__STREAM__${aggregated}` };
            return updated;
          }
          // create a new streaming message and remember its index
          updated.push({ sender: 'ai', text: `__STREAM__${aggregated}` });
          streamMsgIndexRef.current = updated.length - 1;
          return updated;
        });
      };

      // Show breadcrumbs only for tool-call, not for tool-result
      const pushBreadcrumb = (phase: string, toolName?: string) => {
        if (phase !== 'tool-call') return;
        const toFriendly = (name?: string) => {
          switch (name) {
            case 'addFinding':
              return 'Adding finding...';
            case 'removeFinding':
              return 'Removing finding...';
            case 'applyActionOutcome':
              return 'Applying action outcome...';
            case 'setPatientData':
              return 'Updating patient data...';
            case 'resetAll':
              return 'Resetting session...';
            case 'readHealthState':
              return 'Reading health state...';
            case 'readKnownFindings':
              return 'Fetching findings...';
            case 'readTopConditions':
              return 'Analyzing conditions...';
            case 'readActionRanking':
              return 'Ranking next actions...';
            case 'readActionMap':
              return 'Building action map...';
            case 'renderActionGraphMermaid':
              return 'Rendering action diagram...';
            case 'externalSearch':
              return 'Searching the web...';
            default:
              return 'Working...';
          }
        };
        const label = toFriendly(toolName);
        setMessages((prev) => [...prev, { sender: 'ai', text: label, kind: 'breadcrumb' }]);
      };

      const renderUI = (ui: any) => {
        if (ui?.ui === 'finding-chip') {
          return <HealthChip text={ui.id} variant={ui.presence === 'absent' ? 'absent' : 'present'} />;
        }
        if (ui?.ui === 'condition-card') {
          const cond = useStore.getState().rankedConditions.find((c: any) => c.id === ui.conditionId);
          if (cond) return <ConditionCard condition={cond} />;
          return <div className="text-slate-300 text-sm">Condition: {ui.conditionId}</div>;
        }
        if (ui?.ui === 'action-card') {
          const act = useStore.getState().actionRanking.find((a: any) => a.actionId === ui.actionId);
          if (act) return <ActionCard action={act} />;
          return <div className="text-slate-300 text-sm">Action: {ui.actionId}</div>;
        }
        if (ui?.ui === 'mermaid') {
          return <MermaidDiagram definition={ui.definition} />;
        }
        return <div className="text-slate-300 text-xs">{JSON.stringify(ui)}</div>;
      };

      const renderMarkdown = (text: string) => (
        <div className="text-slate-200 text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      );

      const extractSegments = (text: string): Array<{ type: 'markdown' | 'ui'; value: any }> => {
        const segments: Array<{ type: 'markdown' | 'ui'; value: any }> = [];
        if (!text) return segments;

        // First, extract mermaid code blocks ```mermaid ... ```
        const mermaidRegex = /```mermaid[\r\n]+([\s\S]*?)```/g;
        let remaining = text;
        let m: RegExpExecArray | null;
        while ((m = mermaidRegex.exec(text)) !== null) {
          const before = remaining.slice(0, remaining.indexOf(m[0]));
          if (before) segments.push({ type: 'markdown', value: before });
          segments.push({ type: 'ui', value: { ui: 'mermaid', definition: m[1] } });
          remaining = remaining.slice(remaining.indexOf(m[0]) + m[0].length);
        }
        text = remaining;

        // Then, detect inline JSON UI tokens like {"ui":"condition-card",...}
        // We'll scan for occurrences of {"ui": and try to parse minimal JSON blocks.
        const results: Array<{ start: number; end: number; obj: any }> = [];
        const marker = '"ui"';
        let idx = text.indexOf(marker);
        while (idx !== -1) {
          // Find the nearest preceding '{' and following '}' to try JSON.parse
          let start = text.lastIndexOf('{', idx);
          let end = start >= 0 ? text.indexOf('}', idx) : -1;
          let parsed: any = null;
          let found = false;
          while (start >= 0 && end >= 0 && end > start) {
            const candidate = text.slice(start, end + 1);
            try {
              const obj = JSON.parse(candidate);
              if (obj && typeof obj === 'object' && obj.ui) {
                parsed = obj;
                found = true;
                break;
              }
            } catch {}
            end = text.indexOf('}', end + 1);
          }
          if (found && parsed) {
            results.push({ start, end: end!, obj: parsed });
            idx = text.indexOf(marker, end! + 1);
          } else {
            idx = text.indexOf(marker, idx + marker.length);
          }
        }

        if (results.length === 0) {
          segments.push({ type: 'markdown', value: text });
          return segments;
        }

        // Build segments around found UI tokens
        let cursor = 0;
        for (const r of results) {
          if (r.start > cursor) {
            segments.push({ type: 'markdown', value: text.slice(cursor, r.start) });
          }
          segments.push({ type: 'ui', value: r.obj });
          cursor = r.end + 1;
        }
        if (cursor < text.length) {
          segments.push({ type: 'markdown', value: text.slice(cursor) });
        }
        return segments;
      };

      const reconcileToolResult = async () => {
        // Server-authoritative: fetch latest snapshot and replace local state
        try {
          const res = await fetch('/api/state', { cache: 'no-store' });
          if (res.ok) {
            const snapshot = await res.json();
            replaceAll(snapshot);
          }
        } catch (err) {
          console.warn('[ChatPanel] Failed to hydrate after tool-result', err);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'text') {
              aggregated += evt.data;
              pushAIText(evt.data);
            } else if (evt.type === 'breadcrumb') {
              const phase = evt.data?.phase;
              const toolName = evt.data?.toolName;
              pushBreadcrumb(phase, toolName);
            } else if (evt.type === 'done') {
              // Replace the streaming message with one combined bubble containing markdown and inline UI
              const segments = extractSegments(evt.data || aggregated);
              const jsx = (
                <div className="space-y-3">
                  {segments.map((seg, i) => (
                    <div key={i}>
                      {seg.type === 'markdown' ? renderMarkdown(seg.value) : renderUI(seg.value)}
                    </div>
                  ))}
                </div>
              );
              setMessages((prev) => {
                const updated = [...prev];
                const idx = streamMsgIndexRef.current;
                if (idx != null && updated[idx]) {
                  updated[idx] = { sender: 'ai', text: '', jsx } as any;
                } else {
                  updated.push({ sender: 'ai', text: '', jsx } as any);
                }
                streamMsgIndexRef.current = null;
                return updated;
              });
            } else if (evt.type === 'ui') {
              // Inline UI updates outside of final message: show as its own bubble
              const jsx = <div className="space-y-3">{renderUI(evt.data)}</div>;
              setMessages((prev) => [...prev, { sender: 'ai', text: '', jsx } as any]);
            } else if (evt.type === 'tool') {
              // no-op; avoid noisy local echoes
            } else if (evt.type === 'tool-result') {
              // Reconcile store locally so UI reflects changes immediately
              reconcileToolResult();
              // Show contextual UI bubble for added symptoms
              if (evt.data?.toolName === 'addFinding' && evt.data?.args?.id) {
                const id = evt.data.args.id;
                const presence = evt.data.args.presence || 'present';
                const jsx = (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 text-sm">Added:</span>
                    <HealthChip text={id} variant={presence === 'absent' ? 'absent' : 'present'} />
                  </div>
                );
                setMessages((prev) => [...prev, { sender: 'ai', text: '', jsx } as any]);
              }
            } else if (evt.type === 'stateVersion') {
              const incoming = Number(evt.data);
              if (!Number.isNaN(incoming) && incoming > (stateVersion ?? 0)) {
                // re-hydrate when server reports a newer version
                try {
                  const res = await fetch('/api/state', { cache: 'no-store' });
                  if (res.ok) {
                    const snapshot = await res.json();
                    replaceAll(snapshot);
                  }
                } catch {}
              }
            } else if (evt.type === 'error') {
              pushBreadcrumb(`error: ${evt.data}`);
            }
          } catch {}
        }
      }

      // TODO: Use health store to update findings based on chat analysis
      // For now, remove this call since we use store-based architecture

    } catch (error) {
      console.error("Failed to fetch AI response:", error);
      const errorMessage: Message = {
        sender: "ai",
        text: "Sorry, I couldn't get a response. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    console.log("User logged out of the session.");
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-800 rounded-xl border border-pink-500/30 shadow-lg shadow-pink-500/10 p-6">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-slate-100">Assistant</h2>
        <Button
          variant="outline"
          className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 h-8 px-3 text-xs"
          onClick={async () => {
            try {
              const res = await fetch('/api/state/mutate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op: 'resetAll' })
              });
              const snapshot = await res.json();
              replaceAll(snapshot);
              setMessages([{ sender: 'ai', text: 'New conversation started. How can I help you today?' }]);
            } catch (e) {
              console.error('New conversation reset failed', e);
            }
          }}
        >
          New Conversation
        </Button>
      </div>


      <ScrollArea className="flex-1 h-0 mb-4 pr-2">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col mb-3 ${
              msg.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.kind === 'breadcrumb' ? (
              <div className="text-pink-300 text-xs tracking-wide uppercase animate-pulse">
                {msg.text}
              </div>
            ) : (
              <div
                className={`rounded-2xl p-4 max-w-[680px] ${
                  msg.sender === "user"
                    ? "bg-cyan-500 text-slate-900 font-semibold rounded-br-none"
                    : "bg-slate-700 text-slate-200 rounded-bl-none"
                }`}
              >
                {msg.jsx ? (
                  <div className="max-w-full text-slate-200">{msg.jsx}</div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col mb-4 items-start">
            <div className="rounded-2xl bg-slate-700 rounded-bl-none">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        <ScrollBar orientation="vertical" />
      </ScrollArea>

      <form
        onSubmit={handleSubmit}
        className="flex items-center space-x-2 flex-shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your symptoms..."
          disabled={isLoading}
          className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-pink-600 text-white rounded-lg hover:bg-pink-500 transition-colors disabled:bg-pink-600/50 disabled:cursor-not-allowed"
        >
          <SendHorizonal className="w-6 h-6" />
        </button>
      </form>
    </div>
  );
}
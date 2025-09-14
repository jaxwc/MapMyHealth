"use client";

import { useState, FormEvent, useRef, useEffect } from 'react';
import { useHealthStore } from '@/app/state/healthStore';
// Remove unused import - ChatPanel will work with store directly
import { SendHorizonal } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
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
    { sender: "ai", text: "How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamMsgIndexRef = useRef<number | null>(null);

  // Store actions for client-side reconciliation when tools run on the server
  const addFindingStore = useHealthStore(state => state.addFinding);
  const removeFindingStore = useHealthStore(state => state.removeFinding);
  const applyActionOutcomeStore = useHealthStore(state => state.applyActionOutcome);
  const replaceAll = useHealthStore(state => (state as any).replaceAll);

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

      // Show breadcrumbs as small system messages
      const pushBreadcrumb = (label: string) => {
        setMessages((prev) => [...prev, { sender: 'ai', text: `[${label}]` }]);
      };

      const pushUI = (ui: any) => {
        // Simple placeholder: serialize UI blocks into the chat stream.
        // Future: render dedicated components for condition/action cards & mermaid.
        const tag = ui?.ui === 'mermaid' ? 'Mermaid' : 'UI';
        const content = ui?.definition ?? JSON.stringify(ui);
        setMessages((prev) => [...prev, { sender: 'ai', text: `${tag}:\n${content}` }]);
      };

      const mirrorLocalFinding = (args: any) => {
        try {
          if (!args?.id || !args?.presence) return;
          // Optimistic echo in chat; real state comes from store recompute after tool finishes.
          setMessages((prev) => [...prev, { sender: 'ai', text: `(noted) finding ${args.id}: ${args.presence}` }]);
        } catch {}
      };

      const reconcileToolResult = async (toolName: string, args: any) => {
        try {
          if (toolName === 'addFinding' && args?.id && args?.presence) {
            console.debug('[ChatPanel] Reconciling addFinding to client store', args);
            await addFindingStore({ id: args.id, presence: args.presence, value: args.value, daysSinceOnset: args.daysSinceOnset, severity: args.severity, source: 'agent' } as any);
          } else if (toolName === 'removeFinding' && args?.id) {
            console.debug('[ChatPanel] Reconciling removeFinding to client store', args);
            await removeFindingStore(args.id);
          } else if (toolName === 'applyActionOutcome' && args?.actionId && args?.outcomeId) {
            console.debug('[ChatPanel] Reconciling applyActionOutcome to client store', args);
            await applyActionOutcomeStore(args.actionId, args.outcomeId);
          }
        } catch (err) {
          console.warn('[ChatPanel] Failed to reconcile tool result locally', err);
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
              pushBreadcrumb(`${phase}: ${toolName}`);
            } else if (evt.type === 'done') {
              // Replace the tracked streaming message with final text when possible
              setMessages((prev) => {
                const updated = [...prev];
                const idx = streamMsgIndexRef.current;
                if (idx != null && updated[idx]) {
                  updated[idx] = { sender: 'ai', text: evt.data };
                } else {
                  updated.push({ sender: 'ai', text: evt.data });
                }
                streamMsgIndexRef.current = null;
                return updated;
              });
            } else if (evt.type === 'ui') {
              pushUI(evt.data);
            } else if (evt.type === 'tool') {
              if (evt.data?.toolName === 'addFinding') mirrorLocalFinding(evt.data?.args);
            } else if (evt.type === 'tool-result') {
              // Reconcile store locally so UI reflects changes immediately
              if (evt.data?.toolName) {
                reconcileToolResult(evt.data.toolName, evt.data.args);
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
            className={`flex flex-col mb-4 ${
              msg.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`rounded-2xl p-3 max-w-sm ${
                msg.sender === "user"
                  ? "bg-cyan-500 text-slate-900 font-semibold rounded-br-none"
                  : "bg-slate-700 text-slate-200 rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
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
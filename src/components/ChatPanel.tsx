"use client";

import { useState, FormEvent, useRef, useEffect } from 'react';
// Remove unused import - ChatPanel will work with store directly
import { SendHorizonal } from 'lucide-react';
import { Button } from './ui/button';
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentInput }),
      });

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data = await response.json();
      const aiMessage: Message = { sender: "ai", text: data.responseText };
      setMessages((prev) => [...prev, aiMessage]);

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
    <div className="flex flex-col h-full bg-slate-800 rounded-xl border border-pink-500/30 shadow-lg shadow-pink-500/10 p-6">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-slate-100">MapMyHealth</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-white text-black hover:bg-gray-100 text-sm">
              Create New File
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent 
              className="w-48 bg-white p-2 rounded-lg shadow-lg border border-gray-200 z-[9999]"
              side="bottom"
              align="end"
              sideOffset={8}
            >
              <DropdownMenuItem onClick={() => console.log("Create New File clicked")}>
                Create New File
              </DropdownMenuItem>
              {isLoggedIn && (
                <DropdownMenuItem onSelect={handleLogout}>
                  Log Out
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      </div>
        
      <h2 className="text-2xl font-bold mb-4 text-slate-100 flex-shrink-0">
        MapMyHealth
      </h2>


      <div className="flex-grow overflow-y-auto mb-4 pr-2">
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
      </div>

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
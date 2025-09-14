"use client";

import ChatPanel from "@/components/ChatPanel";
import Top from "@/components/top";
import Header from "@/components/Header";
import { useUIStore } from "@/app/state/uiStore";

export default function Home() {
  const { isPanelOpen } = useUIStore();

  return (
    <main className="flex flex-col md:flex-row h-screen w-screen bg-slate-900 font-sans p-4 gap-4 overflow-hidden">

      <div className={`
        h-full min-h-0 flex flex-col transition-all duration-300 ease-in-out
        ${isPanelOpen ? 'w-full md:w-[400px] md:flex-shrink-0' : 'flex-1'}
      `}>
        <Header />
        <div className="flex-1 min-h-0">
          <ChatPanel />
        </div>
      </div>

      <div
        className={`
          h-full transition-all duration-300 ease-in-out relative
          ${isPanelOpen ? 'flex-1 min-w-0' : 'w-0 overflow-hidden'}
        `}
      >
        <div className={`
          absolute inset-0 flex flex-col gap-4 transition-transform duration-300 ease-in-out
          ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="h-full min-h-0 min-w-0 w-full">
            <Top />
          </div>
        </div>
      </div>
    </main>
  );
}
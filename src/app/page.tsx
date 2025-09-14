"use client";

import ChatPanel from "@/components/ChatPanel";
import DiagramPanel from "@/components/bottom";
import Top from "@/components/top";
import Header from "@/components/Header";

export default function Home() {

  return (
    <main className="flex flex-col md:flex-row h-screen w-screen bg-slate-900 font-sans p-4 gap-4 overflow-hidden">

      <div className="w-full md:w-[400px] md:flex-shrink-0 h-full min-h-0 flex flex-col">
        <Header />
        <div className="flex-1 min-h-0">
          <ChatPanel />
        </div>
      </div>


      <div className="flex flex-1 flex-col gap-4 min-w-0 h-full">

        <div className="h-2/3 min-h-0">
          <Top />
        </div>


        <div className="h-1/3 min-h-0">
          <DiagramPanel />
        </div>
      </div>
    </main>
  );
}
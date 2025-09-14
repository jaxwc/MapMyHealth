"use client";

import { useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import DiagramPanel from "@/components/bottom";
import Top from "@/components/top";
import Header from "@/components/Header";

export type HealthData = {
  knowns?: string[];
  unknowns?: string[];
  conditions: { name: string; description: string }[];
  treatments?: string[];
};

export default function Home() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const handleNewHealthData = (data: HealthData) => {
    setHealthData(data);
  };

  return (
    <main className="flex flex-col md:flex-row h-screen w-screen bg-slate-900 font-sans p-4 gap-4 overflow-hidden">

      <div className="w-full md:w-[400px] md:flex-shrink-0 h-full flex flex-col">
        <Header />
        <div className="flex-1">
          <ChatPanel onNewData={handleNewHealthData} />
        </div>
      </div>


      <div className="flex flex-1 flex-col gap-4 min-w-0 h-full">

        <div className="h-2/3 min-h-0">
          <Top data={healthData} />
        </div>


        <div className="h-1/3 min-h-0">
          <DiagramPanel data={healthData} />
        </div>
      </div>
    </main>
  );
}
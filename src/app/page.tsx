"use client";

import { useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import DiagramPanel from "@/components/DiagramPanel";

export type HealthData = {
  conditions: string[];
};

export default function Home() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const handleNewHealthData = (data: HealthData) => {
    setHealthData(data);
  };

  return (

    <main className="flex flex-col md:flex-row h-screen w-screen bg-slate-900 font-sans p-4 gap-4 overflow-hidden">


      <div className="w-full md:w-[400px] md:flex-shrink-0">
        <ChatPanel onNewData={handleNewHealthData} />
      </div>

      <div className="w-full flex-1 flex items-center justify-center min-w-0">
        <DiagramPanel data={healthData} />
      </div>

    </main>
  );
}
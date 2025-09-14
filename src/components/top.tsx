import React from "react";
import { HealthData } from "@/app/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  HeartPulse,
} from "lucide-react";

const InfoChip = ({ text }: { text: string }) => (
  <div className="bg-slate-700/50 p-2 rounded-md text-slate-300 text-sm">
    {text}
  </div>
);

interface TopPanelProps {
  data: HealthData | null;
}

export default function Top({ data }: TopPanelProps) {
  if (!data) {
    return (
      <div className="flex h-full w-full rounded-lg border border-pink-500/30 bg-slate-800 p-8 items-start justify-start">
        <h3 className="text-xl font-bold text-slate-100 flex-shrink-0">
          Analysis Summary
        </h3>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-lg border border-pink-500/30 bg-slate-800 p-6 flex flex-col space-y-3 overflow-y-auto">
      <h3 className="text-xl font-bold text-slate-100 flex-shrink-0">
        Analysis Summary
      </h3>

      <div className="flex flex-col md:flex-row gap-4">
        {data.knowns && data.knowns.length > 0 && (
          <div className="flex-1">
            <h4 className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Knowns
            </h4>
            <div className="flex flex-col space-y-2">
              {data.knowns.slice(0, 3).map((item, i) => (
                <InfoChip key={i} text={item} />
              ))}
            </div>
          </div>
        )}

        {data.unknowns && data.unknowns.length > 0 && (
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
              <HelpCircle className="w-5 h-5" /> Unknowns
            </h4>
            <div className="flex flex-col space-y-2">
              {data.unknowns.slice(0, 3).map((item, i) => (
                <InfoChip key={i} text={item} />
              ))}
            </div>
          </div>
        )}
      </div>

      {data.conditions && data.conditions.length > 0 && (
        <div>
          <h4 className="font-semibold text-pink-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Likely Conditions
          </h4>
          <div className="flex overflow-x-auto gap-4 pb-4">
            {data.conditions.slice(0, 3).map((condition, i) => (
              <Card
                key={i}
                className="w-[280px] flex-shrink-0 rounded-lg bg-slate-700/40 border-pink-500/30 text-slate-200"
              >
                <CardHeader>
                  <CardTitle className="text-pink-400">
                    {condition.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300">
                    {condition.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data.treatments && data.treatments.length > 0 && (
        <div className="flex-shrink-0">
          <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
            <HeartPulse className="w-5 h-5" /> Possible Treatments
          </h4>
          <div className="flex flex-col space-y-2">
            {data.treatments.slice(0, 3).map((item, i) => (
              <InfoChip key={i} text={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

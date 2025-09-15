import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, Wrench, AlertTriangle } from 'lucide-react';

export function ActionCard({ action, selected, onClick }: { action: any; selected?: boolean; onClick?: () => void }) {
  if (!action) return null;
  const label = action.label ?? action.actionId ?? 'Action';
  const utility: number | undefined = typeof action.utility === 'number' ? action.utility : undefined;
  const expectedInfoGain: number | undefined = typeof action.expectedInfoGain === 'number' ? action.expectedInfoGain : undefined;
  const costs = action.costs ?? {};
  const money: number = typeof costs.money === 'number' ? costs.money : 0;
  const timeHours: number = typeof costs.timeHours === 'number' ? costs.timeHours : 0;
  const difficulty: number = typeof costs.difficulty === 'number' ? costs.difficulty : 0;
  const risk: number | undefined = typeof costs.risk === 'number' ? costs.risk : undefined;

  return (
    <Card
      className={`bg-slate-700/40 border-slate-600 cursor-pointer transition-all ${
        selected ? 'border-cyan-400 ring-1 ring-cyan-400/50' : 'hover:border-slate-500'
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-200 flex items-center justify-between">
          <span>{label}</span>
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-green-400">{utility != null ? utility.toFixed(3) : '—'}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-slate-300">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />${money}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeHours}h
            </div>
            <div className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              {difficulty}
            </div>
            {risk != null && risk > 0 && (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-3 h-3" />
                {risk}
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-400">Info Gain: {expectedInfoGain != null ? expectedInfoGain.toFixed(3) : '—'}</div>
      </CardContent>
    </Card>
  );
}



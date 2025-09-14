import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const statusLabelMap: Record<string, string> = {
  'highly-likely': 'Highly Likely',
  likely: 'Likely',
  unknown: 'Possible',
  possible: 'Possible',
  'not-likely': 'Not Likely',
  'very-unlikely': 'Very Unlikely',
};

const statusColorMap: Record<string, string> = {
  'highly-likely': 'text-red-400',
  likely: 'text-orange-400',
  unknown: 'text-yellow-400',
  possible: 'text-yellow-400',
  'not-likely': 'text-blue-400',
  'very-unlikely': 'text-green-400',
};

export function ConditionCard({ condition }: { condition: { name: string; score: number; statusLabel?: string } }) {
  const statusLabel = statusLabelMap[condition.statusLabel || 'unknown'] || condition.statusLabel || 'Possible';
  const statusColor = statusColorMap[condition.statusLabel || 'unknown'] || 'text-slate-400';
  return (
    <Card className="w-[280px] flex-shrink-0 rounded-lg bg-slate-700/40 border-pink-500/30 text-slate-200">
      <CardHeader>
        <CardTitle className="text-pink-400">{condition.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <div className={`text-lg font-bold ${statusColor} mb-1`}>{statusLabel}</div>
          <div className="text-xs text-slate-500 font-mono">{(condition.score * 100).toFixed(1)}% probability</div>
        </div>
      </CardContent>
    </Card>
  );
}



import React, { useState } from 'react';
import { Calendar, TrendingUp, Sparkles, AlertCircle, HelpCircle, ChevronDown, ChevronUp, Trash2, ShieldAlert } from 'lucide-react';
import { GoldGoal, GoldInvestment } from '../types';

interface GoalCardProps {
  key?: string | number;
  goal: GoldGoal;
  progress: {
    accumulatedGrams: number;
    remainingGrams: number;
    completionPercentage: number;
    averageBuyingPrice: number;
    totalInvested: number;
    currentValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    estimatedCostToComplete: number;
    predictedCompletionDate: string | null;
    predictionReasoning: string | null;
  };
  investments: GoldInvestment[];
  currency: string;
  onDeleteGoal: (id: string) => void;
  onDeleteInvestment: (id: string) => void;
  onRefreshData: () => void;
}

function parseBoldText(text: string) {
  const parts = text.split('**');
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold text-gray-900 dark:text-white">{part}</strong> : part);
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-gray-900 dark:text-white mt-4 mb-1.5 flex items-center gap-1">
              {parseBoldText(trimmed.slice(4))}
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-base font-bold text-gray-900 dark:text-white mt-5 mb-2">
              {parseBoldText(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return <p key={idx} className="font-bold text-amber-600 dark:text-yellow-400 mt-2">{parseBoldText(trimmed.slice(2, -2))}</p>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <li key={idx} className="list-disc list-inside pl-2.5 text-gray-600 dark:text-gray-300">
              {parseBoldText(trimmed.slice(2))}
            </li>
          );
        }
        if (trimmed === '') return <div key={idx} className="h-1.5" />;
        return <p key={idx}>{parseBoldText(trimmed)}</p>;
      })}
    </div>
  );
}

export default function GoalCard({
  goal,
  progress,
  investments,
  currency,
  onDeleteGoal,
  onDeleteInvestment,
  onRefreshData,
}: GoalCardProps) {
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [errorPredict, setErrorPredict] = useState('');

  const triggerAIPrediction = async () => {
    setLoadingPredict(true);
    setErrorPredict('');
    try {
      const response = await fetch(`/api/goals/${goal.id}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Prediction engine error');
      }
      onRefreshData();
    } catch (err: any) {
      setErrorPredict(err.message);
    } finally {
      setLoadingPredict(false);
    }
  };

  const isProfit = progress.unrealizedPnL >= 0;
  const isGoalAchieved = progress.remainingGrams <= 0;

  return (
    <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
      {/* Goal Header */}
      <div className="p-5 border-b border-gray-200/60 dark:border-white/10 bg-gray-50/40 dark:bg-black/30 flex justify-between items-start gap-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {goal.name}
            {isGoalAchieved && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded uppercase border border-emerald-500/25">
                Completed
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 font-mono">
            <Calendar className="h-3.5 w-3.5 text-gray-400" /> Target Date: {goal.targetDate}
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this gold goal? This will delete all logged investments linked to this goal as well.')) {
              onDeleteGoal(goal.id);
            }
          }}
          className="text-xs font-semibold text-red-500 hover:text-red-600 p-2 hover:bg-red-500/5 rounded transition-all cursor-pointer"
        >
          Delete
        </button>
      </div>

      {/* Metric Breakdown */}
      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-200/60 dark:border-white/10 bg-white dark:bg-[#111111]">
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Accumulated Gold</span>
          <p className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
            {progress.accumulatedGrams.toFixed(2)} <span className="text-xs font-normal text-gray-500">g</span>
          </p>
          <span className="text-[10px] text-gray-400 dark:text-gray-550 font-mono">Target: {goal.targetGrams}g</span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Remaining to Buy</span>
          <p className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
            {progress.remainingGrams.toFixed(2)} <span className="text-xs font-normal text-gray-500">g</span>
          </p>
          <span className="text-[10px] text-gray-400 dark:text-gray-550 font-mono">
            Est. Cost: {currency} {progress.estimatedCostToComplete.toLocaleString()}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Current Value</span>
          <p className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
            {currency} {progress.currentValue.toLocaleString()}
          </p>
          <span className="text-[10px] text-gray-400 dark:text-gray-550 font-mono">
            Cost: {currency} {progress.totalInvested.toLocaleString()}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Unrealized P&L</span>
          <p className={`text-base font-semibold mt-0.5 flex items-center gap-1 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {isProfit ? '+' : ''}{currency} {progress.unrealizedPnL.toLocaleString()}
          </p>
          <span className={`text-[10px] font-bold ${isProfit ? 'text-emerald-500' : 'text-red-500'} font-mono`}>
            {progress.unrealizedPnLPercent > 0 ? '+' : ''}{progress.unrealizedPnLPercent}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-5 py-4 border-b border-gray-200/60 dark:border-white/10 bg-gray-50/10 dark:bg-black/20">
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">
          <span>Goal Progress</span>
          <span className="font-bold text-gray-900 dark:text-white font-mono">{progress.completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-white/5 h-2 rounded-full overflow-hidden">
          <div
            style={{ width: `${progress.completionPercentage}%` }}
            className="h-full bg-yellow-500 transition-all duration-500"
          />
        </div>
      </div>

      {/* AI Prediction Section */}
      <div className="p-5 border-b border-gray-200/60 dark:border-white/10 flex-1 flex flex-col justify-between bg-white dark:bg-[#111111]">
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-500 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" /> AI Goal Projections
            </span>
            {progress.predictedCompletionDate && (
              <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 dark:bg-yellow-500/5 px-2.5 py-1 rounded border border-yellow-500/20 flex items-center gap-1 font-mono">
                <Calendar className="h-3 w-3" /> Projected: {progress.predictedCompletionDate}
              </span>
            )}
          </div>

          {errorPredict && (
            <div className="mb-3 p-3 bg-red-500/5 border border-red-500/20 rounded text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorPredict}</span>
            </div>
          )}

          {loadingPredict ? (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
                <Sparkles className="absolute h-3.5 w-3.5 text-yellow-500 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-900 dark:text-white">Simulating Gold Price Curves...</p>
                <p className="text-[10px] text-gray-400 max-w-xs leading-relaxed font-mono">
                  Gemini is modeling historical CAGRs, predicted volatility and your monthly budget of {currency} {goal.plannedMonthlyInvestment}/mo...
                </p>
              </div>
            </div>
          ) : progress.predictionReasoning ? (
            <div className="p-4 bg-yellow-500/5 dark:bg-yellow-500/5 rounded border border-yellow-500/10 dark:border-yellow-500/10">
              <MarkdownRenderer content={progress.predictionReasoning} />
            </div>
          ) : (
            <div className="p-6 bg-gray-50/50 dark:bg-black/20 border border-dashed border-gray-200 dark:border-white/5 rounded text-center flex flex-col items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-gray-450 dark:text-gray-500" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">No predictions calculated yet</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-550 max-w-xs leading-relaxed">
                  Trigger the predictive model to calculate your completion milestone based on real gold performance and currency rates.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={triggerAIPrediction}
            disabled={loadingPredict}
            className="px-3.5 py-1.5 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/50 text-black text-xs font-bold uppercase tracking-tight rounded transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{progress.predictionReasoning ? 'Recalculate Projections' : 'Run Prediction Engine'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Purchase Ledger */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-5 py-3.5 border-t border-gray-200/60 dark:border-white/10 flex justify-between items-center text-xs font-bold text-gray-750 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-black/10 transition-all cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            Purchase History Log ({investments.length})
          </span>
          {showHistory ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {showHistory && (
          <div className="px-5 pb-5 border-t border-gray-200/60 dark:border-white/10 bg-gray-50/10 dark:bg-black/20">
            {investments.length === 0 ? (
              <div className="py-6 text-center text-[10px] text-gray-450 font-mono">
                No purchases manually recorded yet for this goal. Use the top menu to record purchases.
              </div>
            ) : (
              <div className="overflow-x-auto mt-3 border border-gray-250 dark:border-white/10 rounded">
                <table className="w-full text-left text-[11px] border-collapse font-mono">
                  <thead>
                    <tr className="bg-gray-100/40 dark:bg-black/40 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-250 dark:border-white/10">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Weight</th>
                      <th className="p-2.5">Cost/g</th>
                      <th className="p-2.5">Total Outlay</th>
                      <th className="p-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-150 dark:border-white/5 hover:bg-gray-50/30 dark:hover:bg-white/5">
                        <td className="p-2.5 text-gray-900 dark:text-white font-medium">{inv.date}</td>
                        <td className="p-2.5 text-gray-500 dark:text-gray-400 capitalize">{inv.type}</td>
                        <td className="p-2.5 text-gray-950 dark:text-white font-semibold">{inv.grams.toFixed(3)}g</td>
                        <td className="p-2.5 text-gray-500 dark:text-gray-400">
                          {currency} {inv.pricePerGram.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-gray-900 dark:text-white font-semibold">
                          {currency} {inv.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this recorded transaction?')) {
                                onDeleteInvestment(inv.id);
                              }
                            }}
                            className="p-1 text-red-500 hover:text-red-650 hover:bg-red-500/5 rounded transition-all cursor-pointer inline-flex items-center"
                            title="Delete transaction record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

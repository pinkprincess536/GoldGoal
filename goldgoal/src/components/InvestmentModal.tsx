import React, { useState, FormEvent } from 'react';
import { X, Scale, Calendar, Landmark, Coins } from 'lucide-react';
import { GoldGoal } from '../types';

interface InvestmentModalProps {
  currency: string;
  goals: GoldGoal[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function InvestmentModal({ currency, goals, onClose, onSuccess }: InvestmentModalProps) {
  const [goalId, setGoalId] = useState(goals[0]?.id || '');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'physical' | 'etf' | 'bond'>('physical');
  const [grams, setGrams] = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!goalId) {
      setError('Please select or create a goal first before recording investments.');
      setLoading(false);
      return;
    }

    if (Number(grams) <= 0) {
      setError('Quantity (grams) must be greater than 0');
      setLoading(false);
      return;
    }

    if (Number(pricePerGram) <= 0) {
      setError('Price per gram must be greater than 0');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/investments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          goalId,
          date,
          type,
          grams: Number(grams),
          pricePerGram: Number(pricePerGram),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record investment');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculatedTotal = Number(grams) && Number(pricePerGram) 
    ? (Number(grams) * Number(pricePerGram)).toFixed(2) 
    : '0.00';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 w-full max-w-md rounded-xl shadow-2xl relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200/60 dark:border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-yellow-500/10 flex items-center justify-center">
              <Coins className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Record Gold Purchase</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-gray-400 hover:text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              Select Destination Goal
            </label>
            <select
              required
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-white text-xs border border-gray-250 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all cursor-pointer"
            >
              <option value="" disabled>-- Choose a Goal --</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.targetGrams}g)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Asset Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'physical', label: 'Physical Gold', icon: Coins },
                { id: 'etf', label: 'Gold ETF', icon: Landmark },
                { id: 'bond', label: 'Sovereign Bond', icon: Scale },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as any)}
                    className={`py-2 px-1.5 border rounded flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      type === item.id
                        ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 font-bold'
                        : 'border-gray-250 dark:border-white/10 bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-400" /> Purchase Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-white text-xs border border-gray-250 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Quantity (Grams)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="e.g. 5.12"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-white text-xs border border-gray-250 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400 font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-450 dark:text-gray-500 font-mono">
                  g
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Purchase Price (per Gram in {currency})
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 84.50"
                value={pricePerGram}
                onChange={(e) => setPricePerGram(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-white text-xs border border-gray-250 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-450 dark:text-gray-500 font-mono">
                {currency}/g
              </span>
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/10 p-3.5 rounded flex justify-between items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Calculated Total Outlay:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
              {currency} {calculatedTotal}
            </span>
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs border border-gray-250 dark:border-white/10 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-tight rounded hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/50 text-black font-bold text-xs uppercase tracking-tight rounded shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save Purchase'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

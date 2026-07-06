import React, { useState, FormEvent } from 'react';
import { X, Award, Target, Calendar, CreditCard } from 'lucide-react';

interface GoalModalProps {
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GoalModal({ currency, onClose, onSuccess }: GoalModalProps) {
  const [name, setName] = useState('');
  const [targetGrams, setTargetGrams] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [plannedMonthly, setPlannedMonthly] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Set default date to 1 year from now
  useState(() => {
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    setTargetDate(oneYearOut.toISOString().split('T')[0]);
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (Number(targetGrams) <= 0) {
      setError('Target quantity must be greater than 0 grams');
      setLoading(false);
      return;
    }

    if (Number(plannedMonthly) < 0) {
      setError('Planned monthly investment cannot be negative');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name,
          targetGrams: Number(targetGrams),
          targetDate,
          plannedMonthlyInvestment: Number(plannedMonthly),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create goal');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 w-full max-w-md rounded-xl shadow-2xl relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200/60 dark:border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-yellow-500/10 flex items-center justify-center">
              <Award className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Create Gold Goal</h2>
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
              <Target className="h-3.5 w-3.5 text-gray-400" /> Goal Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Retirement Savings, Wedding, Child's Education"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-white text-xs border border-gray-250 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Target Gold (Grams)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50"
                  value={targetGrams}
                  onChange={(e) => setTargetGrams(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-white text-xs border border-gray-250 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400 font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">
                  g
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-400" /> Target Date
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-white text-xs border border-gray-250 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-gray-400" /> Planned Monthly Investment ({currency})
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                required
                placeholder="e.g. 500"
                value={plannedMonthly}
                onChange={(e) => setPlannedMonthly(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-white text-xs border border-gray-250 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-all placeholder:text-gray-400 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">
                {currency}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
              This monthly budget is evaluated by the dynamic Goal Engine along with historical and future trends to forecast exactly when the goal is achievable.
            </p>
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
                'Create Goal'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

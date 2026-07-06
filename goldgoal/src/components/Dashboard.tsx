import React, { useState, useEffect } from 'react';
import { 
  Coins, Plus, LogOut, RefreshCw, TrendingUp, TrendingDown, 
  Newspaper, Layers, Landmark, Scale, HelpCircle, AlertCircle
} from 'lucide-react';
import { DashboardData } from '../types';
import GoalCard from './GoalCard';
import GoalModal from './GoalModal';
import InvestmentModal from './InvestmentModal';
import ThemeToggle from './ThemeToggle';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [marketUpdating, setMarketUpdating] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to fetch dashboard data');
      }
      setData(resData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleTickMarket = async () => {
    setMarketUpdating(true);
    try {
      const response = await fetch('/api/market/tick', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Market tick failed');
      // Refetch dashboard data immediately to show updated prices and portfolio values
      await fetchDashboardData();
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setMarketUpdating(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      const response = await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete goal');
      }
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    try {
      const response = await fetch(`/api/investments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete investment');
      }
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="h-12 w-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Assembling GoldGoal Engine...</h2>
            <p className="text-xs text-gray-400">Loading your secure portfolio metrics and live market feeds</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl max-w-sm w-full border border-gray-200 dark:border-zinc-850 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Security / Loading Error</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{error || 'Unable to connect to service'}</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              onLogout();
            }}
            className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black font-semibold text-xs rounded-xl cursor-pointer hover:opacity-90"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const { user, goals, investments, marketPrice, metrics, goalProgress } = data;
  const currencySymbol = user.currency === 'USD' ? '$' : user.currency === 'INR' ? '₹' : user.currency === 'EUR' ? '€' : '£';
  const isPortfolioProfitable = metrics.unrealizedPnL >= 0;

  // Custom SVG Chart parameters
  const chartHistory = marketPrice.history || [];
  const minPrice = chartHistory.length > 0 ? Math.min(...chartHistory.map(h => h.priceLocal)) * 0.98 : 0;
  const maxPrice = chartHistory.length > 0 ? Math.max(...chartHistory.map(h => h.priceLocal)) * 1.02 : 100;
  const priceRange = maxPrice - minPrice;

  // Render variables for asset classes
  const assetTypes = [
    { id: 'physical', label: 'Physical Gold', desc: 'Bullion, Coins, Jewelry', icon: Coins, data: metrics.allocation.physical },
    { id: 'etf', label: 'Gold ETF', desc: 'Exchange Traded Funds', icon: Landmark, data: metrics.allocation.etf },
    { id: 'bond', label: 'Sovereign Bond', desc: 'Sovereign Gold Bonds (SGB)', icon: Scale, data: metrics.allocation.bond },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 transition-colors duration-300 pb-16">
      
      {/* 1. Header Toolbar */}
      <header className="sticky top-0 bg-white/90 dark:bg-[#111111]/90 backdrop-blur-md border-b border-gray-200/60 dark:border-white/10 z-30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-yellow-500 flex items-center justify-center shadow-sm">
              <Coins className="h-4.5 w-4.5 text-black animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white font-sans">
                Gold<span className="text-yellow-500">Goal</span>
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-555 ml-2 font-mono">v1.2 Secure Ledger</span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* User Account Info */}
            <div className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 rounded text-xs flex items-center gap-1.5 border border-gray-200/50 dark:border-white/5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-gray-500 dark:text-gray-400 font-medium">Logged in:</span>
              <span className="font-bold text-gray-900 dark:text-white capitalize">{user.username}</span>
              <span className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 font-extrabold px-1.5 py-0.5 rounded text-[10px]">
                {user.currency}
              </span>
            </div>

            <button
              onClick={() => setShowGoalModal(true)}
              className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs uppercase tracking-tight rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Goal</span>
            </button>

            <button
              onClick={() => {
                if (goals.length === 0) {
                  alert("Please create at least one gold goal first before recording gold investments.");
                  return;
                }
                setShowInvestmentModal(true);
              }}
              className="px-3 py-1.5 bg-gray-900 dark:bg-black hover:bg-gray-800 dark:hover:bg-black/80 text-white dark:text-gray-200 font-bold text-xs uppercase tracking-tight rounded shadow-sm border border-transparent dark:border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Coins className="h-3.5 w-3.5 text-yellow-500" />
              <span>Record Purchase</span>
            </button>

            <ThemeToggle />

            <button
              onClick={() => {
                localStorage.removeItem('token');
                onLogout();
              }}
              className="p-2 bg-transparent text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">

        {/* 2. Interactive Market Ticker Banner */}
        <section className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-yellow-500" />
          
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-yellow-600 dark:text-yellow-500 tracking-wider">Independent Live Gold Feed</span>
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                {currencySymbol} {marketPrice.currentPriceLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">/ gram</span>
              </h2>
              <div className="flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                <TrendingUp className="h-3 w-3 mr-0.5" />
                Live Spot
              </div>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
              Spot Price Conversions: <span className="font-semibold text-gray-700 dark:text-gray-300">1g = USD ${(marketPrice.currentPriceUSD).toFixed(2)}</span> | Updated: {new Date(marketPrice.lastUpdated).toLocaleTimeString()}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <span className="text-[11px] text-gray-400 dark:text-gray-550 text-right max-w-xs hidden lg:block leading-relaxed font-sans">
              Maintain separation: historical assets are never revalued, while current assets utilize this feed.
            </span>
            <button
              onClick={handleTickMarket}
              disabled={marketUpdating}
              className="px-3.5 py-1.5 border border-gray-250 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-black/40 text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-sm transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${marketUpdating ? 'animate-spin text-yellow-500' : ''}`} />
              <span>{marketUpdating ? 'Updating Feed...' : 'Tick Market Feed'}</span>
            </button>
          </div>
        </section>

        {/* 3. Core Portfolio Financial Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4.5">
          
          <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 p-5 rounded-xl shadow-sm flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-450 tracking-wider">Total Accumulated Gold</span>
            <div className="mt-2">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {metrics.totalHoldingsGrams.toFixed(3)} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">grams</span>
              </p>
              <span className="text-[10px] text-gray-400 dark:text-gray-550 mt-1 block">Across all gold goals and types</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 p-5 rounded-xl shadow-sm flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-450 tracking-wider">Average Buying Price</span>
            <div className="mt-2">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {currencySymbol} {metrics.averageBuyingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">/g</span>
              </p>
              <span className="text-[10px] text-gray-400 dark:text-gray-555 mt-1 block">
                Compared to Live spot: {metrics.averageBuyingPrice > marketPrice.currentPriceLocal ? 'Above Spot' : 'Below Spot'}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 p-5 rounded-xl shadow-sm flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-450 tracking-wider">Current Portfolio Value</span>
            <div className="mt-2">
              <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-500 font-mono">
                {currencySymbol} {metrics.currentPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-gray-400 dark:text-gray-555 mt-1 block">
                Total Net Cost: {currencySymbol} {metrics.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 p-5 rounded-xl shadow-sm flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-450 tracking-wider">Total Portfolio Yield (PnL)</span>
            <div className="mt-2">
              <p className={`text-2xl font-semibold flex items-center gap-1 ${isPortfolioProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {isPortfolioProfitable ? '+' : ''}{currencySymbol} {metrics.unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className={`text-[10px] font-bold ${isPortfolioProfitable ? 'text-emerald-500' : 'text-red-500'} mt-1 block`}>
                {metrics.unrealizedPnLPercent > 0 ? '+' : ''}{metrics.unrealizedPnLPercent}% Unrealized Yield
              </span>
            </div>
          </div>

        </section>

        {/* 4. Interactive Bento Grid Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Pane (Market Analytics & News) */}
          <div className="space-y-6 lg:col-span-1">
            
            {/* 12-Month Price Trend SVG Chart */}
            <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 p-5 rounded-xl shadow-sm space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">12-Month Spot Trend ({user.currency})</span>
              
              {chartHistory.length > 0 ? (
                <div className="w-full h-44 relative bg-gray-50/50 dark:bg-black/20 rounded-lg p-2 flex flex-col justify-between border border-gray-100 dark:border-white/5">
                  {/* SVG Chart */}
                  <svg className="w-full h-32 overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#eab308" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#eab308" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Area path */}
                    <path
                      d={`M 0 30 ${chartHistory.map((h, i) => {
                        const x = (i / (chartHistory.length - 1)) * 100;
                        const y = 30 - (((h.priceLocal - minPrice) / priceRange) * 26);
                        return `L ${x} ${y}`;
                      }).join(' ')} L 100 30 Z`}
                      fill="url(#chartGrad)"
                    />
                    
                    {/* Line path */}
                    <path
                      d={chartHistory.map((h, i) => {
                        const x = (i / (chartHistory.length - 1)) * 100;
                        const y = 30 - (((h.priceLocal - minPrice) / priceRange) * 26);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />

                    {/* Interactive dots */}
                    {chartHistory.map((h, i) => {
                      const x = (i / (chartHistory.length - 1)) * 100;
                      const y = 30 - (((h.priceLocal - minPrice) / priceRange) * 26);
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r="1.2"
                          className="fill-yellow-500 dark:fill-yellow-500 group cursor-pointer hover:r-2 hover:fill-white dark:hover:fill-zinc-950 hover:stroke-yellow-500"
                        >
                          <title>{h.date}: {currencySymbol}{h.priceLocal}</title>
                        </circle>
                      );
                    })}
                  </svg>

                  {/* Chart axis labels */}
                  <div className="flex justify-between text-[8px] font-bold text-gray-400 font-mono">
                    <span>{chartHistory[0]?.date.slice(2, 7)}</span>
                    <span>{chartHistory[Math.floor(chartHistory.length / 2)]?.date.slice(2, 7)}</span>
                    <span>{chartHistory[chartHistory.length - 1]?.date.slice(2, 7)}</span>
                  </div>
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center text-xs text-gray-400">
                  No price trend data recorded
                </div>
              )}
            </div>

            {/* Asset Allocation Breakdown */}
            <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-550 dark:text-gray-400">Asset Allocation</span>
              </div>

              <div className="space-y-3.5">
                {assetTypes.map((asset) => {
                  const percent = metrics.totalHoldingsGrams > 0 
                    ? Math.round((asset.data.grams / metrics.totalHoldingsGrams) * 100) 
                    : 0;

                  return (
                    <div key={asset.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <asset.icon className="h-3.5 w-3.5 text-gray-400" />
                          <div>
                            <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">{asset.label}</span>
                            <span className="block text-[9px] text-gray-450 dark:text-gray-500">{asset.desc}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-900 dark:text-white text-xs">{percent}%</span>
                          <span className="block text-[9px] text-gray-500 dark:text-gray-400 font-mono">{asset.data.grams.toFixed(2)} g</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            asset.id === 'physical' ? 'bg-yellow-500' : asset.id === 'etf' ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-gray-400 dark:bg-gray-300'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Market News Ticker (Independent context) */}
            <div className="bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 p-5 rounded-xl shadow-sm space-y-3.5">
              <div className="flex items-center gap-1.5 border-b border-gray-150 dark:border-white/5 pb-2.5">
                <Newspaper className="h-4 w-4 text-yellow-600 dark:text-yellow-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-550 dark:text-gray-400">Market News Ticker</span>
              </div>

              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {marketPrice.news.map((item) => (
                  <div key={item.id} className="text-[11px] space-y-1 p-2 rounded border border-gray-100 dark:border-white/5 bg-gray-50/20 dark:bg-black/20">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white line-clamp-1">{item.title}</span>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                        item.sentiment === 'bullish' 
                          ? 'text-emerald-500 border-emerald-500/15 bg-emerald-500/5' 
                          : item.sentiment === 'bearish' 
                          ? 'text-red-500 border-red-500/15 bg-red-500/5' 
                          : 'text-gray-500 border-gray-200 bg-gray-100 dark:bg-zinc-900 dark:border-zinc-850'
                      }`}>
                        {item.sentiment}
                      </span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-450 leading-relaxed text-[10px]">{item.description}</p>
                    <span className="text-[8px] text-gray-400 dark:text-gray-550 block mt-1 font-mono">{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Pane (Gold Savings Goals Dashboard) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Active Gold Goals</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recalculate progress ratios and view AI forecasting completions</p>
              </div>
              <button
                onClick={() => setShowGoalModal(true)}
                className="px-3.5 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs uppercase tracking-tight rounded shadow-sm flex items-center gap-1 cursor-pointer transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Goal</span>
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-[#111111] border border-gray-250 dark:border-white/10 rounded-xl flex flex-col items-center justify-center gap-4 shadow-sm">
                <div className="h-10 w-10 rounded bg-yellow-500/10 flex items-center justify-center text-yellow-600 dark:text-yellow-500">
                  <Coins className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">No active gold goals found</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                    Create your first goal target (e.g. Retirement, Wedding) to track asset allocations and estimate target milestones.
                  </p>
                </div>
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs uppercase tracking-tight rounded cursor-pointer"
                >
                  Create Gold Goal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {goals.map((goal) => {
                  const progress = goalProgress[goal.id] || {
                    accumulatedGrams: 0,
                    remainingGrams: goal.targetGrams,
                    completionPercentage: 0,
                    averageBuyingPrice: 0,
                    totalInvested: 0,
                    currentValue: 0,
                    unrealizedPnL: 0,
                    unrealizedPnLPercent: 0,
                    estimatedCostToComplete: 0,
                    predictedCompletionDate: null,
                    predictionReasoning: null,
                  };

                  const goalInvestments = investments.filter(i => i.goalId === goal.id);

                  return (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      progress={progress}
                      investments={goalInvestments}
                      currency={user.currency}
                      onDeleteGoal={handleDeleteGoal}
                      onDeleteInvestment={handleDeleteInvestment}
                      onRefreshData={fetchDashboardData}
                    />
                  );
                })}
              </div>
            )}
          </div>

        </section>

      </main>

      {/* 5. Modals */}
      {showGoalModal && (
        <GoalModal
          currency={user.currency}
          onClose={() => setShowGoalModal(false)}
          onSuccess={() => {
            setShowGoalModal(false);
            fetchDashboardData();
          }}
        />
      )}

      {showInvestmentModal && (
        <InvestmentModal
          currency={user.currency}
          goals={goals}
          onClose={() => setShowInvestmentModal(false)}
          onSuccess={() => {
            setShowInvestmentModal(false);
            fetchDashboardData();
          }}
        />
      )}

    </div>
  );
}

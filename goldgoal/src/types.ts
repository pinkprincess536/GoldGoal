export type InvestmentType = 'physical' | 'etf' | 'bond';

export interface User {
  id: string;
  username: string;
  currency: 'USD' | 'INR' | 'EUR' | 'GBP';
}

export interface GoldGoal {
  id: string;
  userId: string;
  name: string;
  targetGrams: number;
  targetDate: string; // YYYY-MM-DD
  plannedMonthlyInvestment: number; // In user's selected currency
  createdAt: string;
}

export interface GoldInvestment {
  id: string;
  userId: string;
  goalId: string;
  date: string; // YYYY-MM-DD
  type: InvestmentType;
  grams: number;
  pricePerGram: number; // In user's selected currency
  totalCost: number; // grams * pricePerGram
  notes?: string;
}

export interface GoldPriceRecord {
  date: string; // YYYY-MM-DD
  pricePerGramUSD: number;
}

export interface MarketNews {
  id: string;
  title: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  description: string;
  date: string;
}

export interface MarketPrice {
  currentPriceUSD: number;
  lastUpdated: string;
  history: GoldPriceRecord[];
  news: MarketNews[];
}

export interface GoalProgress {
  goalId: string;
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
}

export interface DashboardData {
  user: User;
  goals: GoldGoal[];
  investments: GoldInvestment[];
  marketPrice: {
    currentPriceUSD: number;
    currentPriceLocal: number;
    lastUpdated: string;
    news: MarketNews[];
    history: { date: string; priceUSD: number; priceLocal: number }[];
  };
  metrics: {
    totalHoldingsGrams: number;
    totalInvested: number;
    currentPortfolioValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    averageBuyingPrice: number;
    allocation: {
      physical: { grams: number; invested: number; value: number };
      etf: { grams: number; invested: number; value: number };
      bond: { grams: number; invested: number; value: number };
    };
  };
  goalProgress: Record<string, GoalProgress>;
}

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Shared Currency conversion rates (relative to USD)
const CONVERSION_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.78,
};

// Database Schema interfaces
interface DBUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  currency: 'USD' | 'INR' | 'EUR' | 'GBP';
  createdAt: string;
}

interface DBSession {
  token: string;
  userId: string;
  expiresAt: number;
}

interface DBGoal {
  id: string;
  userId: string;
  name: string;
  targetGrams: number;
  targetDate: string; // YYYY-MM-DD
  plannedMonthlyInvestment: number; // in user's currency
  predictedCompletionDate: string | null;
  predictionReasoning: string | null;
  createdAt: string;
}

interface DBInvestment {
  id: string;
  userId: string;
  goalId: string;
  date: string; // YYYY-MM-DD
  type: 'physical' | 'etf' | 'bond';
  grams: number;
  pricePerGram: number; // in user's currency
  totalCost: number; // in user's currency
  notes?: string;
  createdAt: string;
}

interface DBMarketNews {
  id: string;
  title: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  description: string;
  date: string;
}

interface DatabaseSchema {
  users: DBUser[];
  sessions: DBSession[];
  goals: DBGoal[];
  investments: DBInvestment[];
  marketPrice: {
    currentPriceUSD: number;
    lastUpdated: string;
    history: { date: string; pricePerGramUSD: number }[];
    news: DBMarketNews[];
  };
}

const DB_FILE = path.join(process.cwd(), "database.json");

// Helper to load/save DB
function loadDatabase(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    // Generate initial seeds
    const initialPrice = 82.45; // USD per gram (~$2560 per ounce)
    const history: { date: string; pricePerGramUSD: number }[] = [];
    
    // Generate 12 months of historical prices
    const now = new Date();
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      // Create a nice growth curve with some fluctuations
      const factor = 1 + (12 - i) * 0.02 + (Math.sin(12 - i) * 0.015);
      history.push({
        date: d.toISOString().split('T')[0].substring(0, 7) + "-01",
        pricePerGramUSD: Math.round((initialPrice * factor) * 100) / 100,
      });
    }

    const news: DBMarketNews[] = [
      {
        id: "n1",
        title: "Gold Prices Steady Near Historic Highs",
        sentiment: "bullish",
        description: "Precious metals continue to show strong support from central bank buying and global macroeconomic hedge demand.",
        date: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      },
      {
        id: "n2",
        title: "Central Banks Expand Physical Gold Reserves",
        sentiment: "bullish",
        description: "Official institutions added over 40 tons of gold bullion to international reserves this quarter, maintaining long-term price support.",
        date: new Date(now.getTime() - 1000 * 60 * 60 * 36).toISOString(),
      },
      {
        id: "n3",
        title: "Federal Reserve Rates Under Scrutiny, Impacting Bullion Yields",
        sentiment: "neutral",
        description: "Traders balance interest rate signals from Fed governors, resulting in consolidation across ETF and physical markets.",
        date: new Date(now.getTime() - 1000 * 60 * 60 * 60).toISOString(),
      },
    ];

    const db: DatabaseSchema = {
      users: [],
      sessions: [],
      goals: [],
      investments: [],
      marketPrice: {
        currentPriceUSD: 84.12,
        lastUpdated: now.toISOString(),
        history,
        news,
      },
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }

  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file, creating fresh one", err);
    return {
      users: [],
      sessions: [],
      goals: [],
      investments: [],
      marketPrice: { currentPriceUSD: 84.12, lastUpdated: new Date().toISOString(), history: [], news: [] }
    };
  }
}

function saveDatabase(db: DatabaseSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Password Hashing helpers
function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

// Authentication Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const db = loadDatabase();
  const session = db.sessions.find(s => s.token === token);

  if (!session) {
    return res.status(403).json({ error: "Session invalid or expired" });
  }

  if (session.expiresAt < Date.now()) {
    // Clean up expired session
    db.sessions = db.sessions.filter(s => s.token !== token);
    saveDatabase(db);
    return res.status(403).json({ error: "Session expired" });
  }

  const user = db.users.find(u => u.id === session.userId);
  if (!user) {
    return res.status(403).json({ error: "User not found" });
  }

  req.user = {
    id: user.id,
    username: user.username,
    currency: 'INR',
  };
  next();
}

app.use(express.json());

// --- API ROUTES ---

// 1. AUTH REGISTER
app.post("/api/auth/register", (req, res) => {
  const { username, password, currency } = req.body;

  if (!username || !password || !currency) {
    return res.status(400).json({ error: "Username, password, and currency are required" });
  }

  const db = loadDatabase();
  const normalizedUsername = username.trim().toLowerCase();

  const userExists = db.users.some(u => u.username.toLowerCase() === normalizedUsername);
  if (userExists) {
    return res.status(400).json({ error: "Username is already taken" });
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  const newUser: DBUser = {
    id: crypto.randomUUID(),
    username: username.trim(),
    passwordHash,
    salt,
    currency: 'INR',
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);

  // Generate session token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days

  db.sessions.push({
    token,
    userId: newUser.id,
    expiresAt,
  });

  saveDatabase(db);

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      username: newUser.username,
      currency: 'INR',
    }
  });
});

// 2. AUTH LOGIN
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const db = loadDatabase();
  const normalizedUsername = username.trim().toLowerCase();

  const user = db.users.find(u => u.username.toLowerCase() === normalizedUsername);
  if (!user) {
    return res.status(400).json({ error: "Invalid username or password" });
  }

  const checkHash = hashPassword(password, user.salt);
  if (checkHash !== user.passwordHash) {
    return res.status(400).json({ error: "Invalid username or password" });
  }

  // Create session
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days

  db.sessions.push({
    token,
    userId: user.id,
    expiresAt,
  });

  saveDatabase(db);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      currency: 'INR',
    }
  });
});

// 3. AUTH ME
app.get("/api/auth/me", authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});

// 4. GET DASHBOARD DATA
app.get("/api/dashboard", authenticateToken, (req: any, res) => {
  const db = loadDatabase();
  const userId = req.user.id;
  const userCurrency = req.user.currency;
  const conversionRate = CONVERSION_RATES[userCurrency] || 1.0;

  // Filter goals and investments for user
  const userGoals = db.goals.filter(g => g.userId === userId);
  const userInvestments = db.investments.filter(i => i.userId === userId);

  // Convert Gold prices to preferred currency
  const currentPriceUSD = db.marketPrice.currentPriceUSD;
  const currentPriceLocal = Math.round((currentPriceUSD * conversionRate) * 100) / 100;

  // Prepare market history
  const historyConverted = db.marketPrice.history.map(h => ({
    date: h.date,
    priceUSD: h.pricePerGramUSD,
    priceLocal: Math.round((h.pricePerGramUSD * conversionRate) * 100) / 100,
  }));

  // Standard Financial Metrics Calculations
  let totalHoldingsGrams = 0;
  let totalInvested = 0;

  const allocation = {
    physical: { grams: 0, invested: 0, value: 0 },
    etf: { grams: 0, invested: 0, value: 0 },
    bond: { grams: 0, invested: 0, value: 0 },
  };

  userInvestments.forEach(inv => {
    totalHoldingsGrams += inv.grams;
    totalInvested += inv.totalCost;

    if (allocation[inv.type]) {
      allocation[inv.type].grams += inv.grams;
      allocation[inv.type].invested += inv.totalCost;
    }
  });

  // Value current portfolio
  const currentPortfolioValue = Math.round((totalHoldingsGrams * currentPriceLocal) * 100) / 100;
  const unrealizedPnL = Math.round((currentPortfolioValue - totalInvested) * 100) / 100;
  const unrealizedPnLPercent = totalInvested > 0 ? Math.round(((unrealizedPnL / totalInvested) * 100) * 100) / 100 : 0;
  const averageBuyingPrice = totalHoldingsGrams > 0 ? Math.round((totalInvested / totalHoldingsGrams) * 100) / 100 : 0;

  // Calculate allocation values using current price
  Object.keys(allocation).forEach(type => {
    const t = type as 'physical' | 'etf' | 'bond';
    allocation[t].value = Math.round((allocation[t].grams * currentPriceLocal) * 100) / 100;
  });

  // Calculate goal-specific progress
  const goalProgress: Record<string, any> = {};
  userGoals.forEach(goal => {
    // Sum investments for this goal
    const goalInvestments = userInvestments.filter(i => i.goalId === goal.id);
    let accumulatedGrams = 0;
    let goalInvested = 0;

    goalInvestments.forEach(i => {
      accumulatedGrams += i.grams;
      goalInvested += i.totalCost;
    });

    const remainingGrams = Math.max(0, goal.targetGrams - accumulatedGrams);
    const completionPercentage = Math.round((Math.min(goal.targetGrams, accumulatedGrams) / goal.targetGrams) * 100);
    const goalAveragePrice = accumulatedGrams > 0 ? Math.round((goalInvested / accumulatedGrams) * 100) / 100 : 0;
    const goalCurrentValue = Math.round((accumulatedGrams * currentPriceLocal) * 100) / 100;
    const goalPnL = Math.round((goalCurrentValue - goalInvested) * 100) / 100;
    const goalPnLPercent = goalInvested > 0 ? Math.round(((goalPnL / goalInvested) * 100) * 100) / 100 : 0;

    // Estimate cost to complete based on current price
    const estimatedCostToComplete = Math.round((remainingGrams * currentPriceLocal) * 100) / 100;

    goalProgress[goal.id] = {
      goalId: goal.id,
      accumulatedGrams,
      remainingGrams,
      completionPercentage,
      averageBuyingPrice: goalAveragePrice,
      totalInvested: goalInvested,
      currentValue: goalCurrentValue,
      unrealizedPnL: goalPnL,
      unrealizedPnLPercent: goalPnLPercent,
      estimatedCostToComplete,
      predictedCompletionDate: goal.predictedCompletionDate,
      predictionReasoning: goal.predictionReasoning,
    };
  });

  res.json({
    user: req.user,
    goals: userGoals,
    investments: userInvestments,
    marketPrice: {
      currentPriceUSD,
      currentPriceLocal,
      lastUpdated: db.marketPrice.lastUpdated,
      news: db.marketPrice.news,
      history: historyConverted,
    },
    metrics: {
      totalHoldingsGrams,
      totalInvested,
      currentPortfolioValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      averageBuyingPrice,
      allocation,
    },
    goalProgress,
  });
});

// 5. CREATE GOAL
app.post("/api/goals", authenticateToken, (req: any, res) => {
  const { name, targetGrams, targetDate, plannedMonthlyInvestment } = req.body;

  if (!name || !targetGrams || !targetDate || plannedMonthlyInvestment === undefined) {
    return res.status(400).json({ error: "Goal name, target grams, target date, and planned monthly investment are required" });
  }

  const db = loadDatabase();
  const newGoal: DBGoal = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    name: name.trim(),
    targetGrams: Number(targetGrams),
    targetDate,
    plannedMonthlyInvestment: Number(plannedMonthlyInvestment),
    predictedCompletionDate: null,
    predictionReasoning: null,
    createdAt: new Date().toISOString(),
  };

  db.goals.push(newGoal);
  saveDatabase(db);

  res.status(201).json(newGoal);
});

// 6. DELETE GOAL (and its investments)
app.delete("/api/goals/:id", authenticateToken, (req: any, res) => {
  const goalId = req.params.id;
  const db = loadDatabase();

  const goalIndex = db.goals.findIndex(g => g.id === goalId && g.userId === req.user.id);
  if (goalIndex === -1) {
    return res.status(404).json({ error: "Goal not found" });
  }

  db.goals.splice(goalIndex, 1);
  // Also clean up its investments to avoid orphans
  db.investments = db.investments.filter(i => i.goalId !== goalId || i.userId !== req.user.id);

  saveDatabase(db);
  res.json({ message: "Goal and associated investments deleted successfully" });
});

// 7. RECORD INVESTMENT (never modified, per user specifications)
app.post("/api/investments", authenticateToken, (req: any, res) => {
  const { goalId, date, type, grams, pricePerGram } = req.body;

  if (!goalId || !date || !type || !grams || !pricePerGram) {
    return res.status(400).json({ error: "All purchase details (goal, date, type, quantity, price) are required" });
  }

  const db = loadDatabase();
  
  // Verify goal belongs to user
  const goalExists = db.goals.some(g => g.id === goalId && g.userId === req.user.id);
  if (!goalExists) {
    return res.status(404).json({ error: "Selected goal was not found" });
  }

  const qty = Number(grams);
  const ppg = Number(pricePerGram);
  const totalCost = Math.round((qty * ppg) * 100) / 100;

  const newInvestment: DBInvestment = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    goalId,
    date,
    type: type as any,
    grams: qty,
    pricePerGram: ppg,
    totalCost,
    createdAt: new Date().toISOString(),
  };

  db.investments.push(newInvestment);
  saveDatabase(db);

  res.status(201).json(newInvestment);
});

// 8. DELETE INVESTMENT
app.delete("/api/investments/:id", authenticateToken, (req: any, res) => {
  const investmentId = req.params.id;
  const db = loadDatabase();

  const invIndex = db.investments.findIndex(i => i.id === investmentId && i.userId === req.user.id);
  if (invIndex === -1) {
    return res.status(404).json({ error: "Investment record not found" });
  }

  db.investments.splice(invIndex, 1);
  saveDatabase(db);
  res.json({ message: "Investment record deleted" });
});

// 9. RECALCULATE PREDICTIONS VIA GEMINI
app.post("/api/goals/:id/predict", authenticateToken, async (req: any, res) => {
  const goalId = req.params.id;
  const db = loadDatabase();

  const goal = db.goals.find(g => g.id === goalId && g.userId === req.user.id);
  if (!goal) {
    return res.status(404).json({ error: "Goal not found" });
  }

  const userCurrency = req.user.currency;
  const conversionRate = CONVERSION_RATES[userCurrency] || 1.0;
  const currentPriceLocal = Math.round((db.marketPrice.currentPriceUSD * conversionRate) * 100) / 100;

  // Fetch investments for this goal
  const goalInvestments = db.investments.filter(i => i.goalId === goal.id);
  let accumulatedGrams = 0;
  let totalInvested = 0;
  goalInvestments.forEach(i => {
    accumulatedGrams += i.grams;
    totalInvested += i.totalCost;
  });

  const remainingGrams = Math.max(0, goal.targetGrams - accumulatedGrams);

  // If already reached, complete instantly
  if (remainingGrams <= 0) {
    goal.predictedCompletionDate = goalInvestments.length > 0 ? goalInvestments[goalInvestments.length - 1].date : new Date().toISOString().split('T')[0];
    goal.predictionReasoning = "### 🎉 Congratulations!\n\nYou have fully achieved your gold ownership goal of **" + goal.targetGrams + " grams**! Your discipline and planning have paid off successfully.";
    saveDatabase(db);
    return res.json({
      predictedCompletionDate: goal.predictedCompletionDate,
      predictionReasoning: goal.predictionReasoning,
    });
  }

  // Use Gemini to forecast completion
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    // Fallback simple prediction algorithm if Gemini is not configured
    const monthsNeeded = goal.plannedMonthlyInvestment > 0 ? Math.ceil((remainingGrams * currentPriceLocal) / goal.plannedMonthlyInvestment) : 120;
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsNeeded);
    const predictedDateStr = completionDate.toISOString().split('T')[0];

    goal.predictedCompletionDate = predictedDateStr;
    goal.predictionReasoning = `### ⚠️ AI Prediction Engine (Local Sandbox)
*Note: The actual Gemini API key was not configured, so we used a conservative static projection.*

Based on your current gold purchase trend:
- **Remaining Grams**: ${remainingGrams.toFixed(2)} g
- **Monthly Budget**: ${userCurrency} ${goal.plannedMonthlyInvestment.toFixed(2)}
- **Estimated Months Required**: ${monthsNeeded} months
- **Projected Completion**: **${predictedDateStr}**

To speed up your gold acquisition, consider increasing your planned monthly investment or consolidating allocation into more price-efficient assets like Gold ETFs.`;

    saveDatabase(db);
    return res.json({
      predictedCompletionDate: goal.predictedCompletionDate,
      predictionReasoning: goal.predictionReasoning,
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const trendData = db.marketPrice.history.map(h => ({
      date: h.date,
      priceLocal: Math.round((h.pricePerGramUSD * conversionRate) * 100) / 100,
    }));

    const prompt = `Analyze this gold savings goal and current holdings to predict when the user will achieve it.

User Currency: ${userCurrency}
Current Gold Price per gram: ${currentPriceLocal} ${userCurrency}
Historical Gold Price Trend (last 12 months): ${JSON.stringify(trendData)}

Savings Goal:
- Name: "${goal.name}"
- Target Quantity: ${goal.targetGrams} grams of Gold
- Target Completion Date: ${goal.targetDate}
- User's Planned Monthly Investment Budget: ${goal.plannedMonthlyInvestment} ${userCurrency}

User's Existing Gold Holdings for this goal:
- Accumulated Gold: ${accumulatedGrams.toFixed(2)} grams
- Total Invested Amount: ${totalInvested.toFixed(2)} ${userCurrency}
- Purchase History details: ${JSON.stringify(goalInvestments.map(i => ({ date: i.date, type: i.type, grams: i.grams, price: i.pricePerGram, cost: i.totalCost })))}

Please perform a financial simulation:
1. Model future gold price growth (CAGR) based on the provided history.
2. Calculate when the user's monthly budget (${goal.plannedMonthlyInvestment} ${userCurrency}/month) can buy the remaining ${remainingGrams.toFixed(2)} grams, accounting for rising/falling gold price estimations.
3. Determine the realistic predicted achievement date in YYYY-MM-DD format.
4. Give an honest, high-value assessment of whether they will hit their target date of ${goal.targetDate}.
5. Formulate actionable strategies to achieve the goal faster (such as increasing contribution or using tax-efficient instruments like Sovereign Gold Bonds or low-expense Gold ETFs).

You must respond in structured JSON format according to the schema. Format the reasoning as rich, friendly Markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedCompletionDate: {
              type: Type.STRING,
              description: "The predicted completion date in YYYY-MM-DD format, or null if unachievable under current conditions."
            },
            reasoning: {
              type: Type.STRING,
              description: "A comprehensive financial projection analysis written in warm, professional markdown."
            }
          },
          required: ["predictedCompletionDate", "reasoning"]
        }
      }
    });

    const result = JSON.parse(response.text.trim());
    
    goal.predictedCompletionDate = result.predictedCompletionDate;
    goal.predictionReasoning = result.reasoning;

    saveDatabase(db);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini goal engine error:", error);
    res.status(500).json({ error: "Failed to generate AI predictions. " + error.message });
  }
});

// 10. TICK MARKET (Simulate active market updates)
app.post("/api/market/tick", (req, res) => {
  const db = loadDatabase();
  const currentPriceUSD = db.marketPrice.currentPriceUSD;

  // Fluctuate price slightly (+/- 0.1% to 0.6%)
  const direction = Math.random() > 0.45 ? 1 : -1; // slightly upward biased long-term
  const percent = 0.001 + Math.random() * 0.005;
  const delta = currentPriceUSD * percent * direction;
  const nextPrice = Math.round((currentPriceUSD + delta) * 100) / 100;

  db.marketPrice.currentPriceUSD = nextPrice;
  const now = new Date();
  db.marketPrice.lastUpdated = now.toISOString();

  // Keep last 30 daily price recordings (for visual charts)
  // Check if date already exists
  const todayStr = now.toISOString().split('T')[0];
  const existingIndex = db.marketPrice.history.findIndex(h => h.date === todayStr);
  if (existingIndex !== -1) {
    db.marketPrice.history[existingIndex].pricePerGramUSD = nextPrice;
  } else {
    db.marketPrice.history.push({
      date: todayStr,
      pricePerGramUSD: nextPrice,
    });
    // Trim history to 30 elements
    if (db.marketPrice.history.length > 30) {
      db.marketPrice.history.shift();
    }
  }

  // Randomly append a new news ticker item occasionally
  const newsOptions = [
    {
      title: "Rising Inflation Estimates Lift Precious Metals Appeal",
      sentiment: "bullish",
      description: "Consumer price index forecasts cause investors to hedge with physical gold asset classes.",
    },
    {
      title: "Gold Markets Quiet Ahead of Central Bank Speeches",
      sentiment: "neutral",
      description: "Precious metals undergo consolidation with volume shifting slightly to spot trades.",
    },
    {
      title: "Strengthening Dollar Limits Gold Upside",
      sentiment: "bearish",
      description: "Global currency indexes rally, exerting technical selling pressure on gold bullion per gram.",
    },
    {
      title: "Unprecedented Retail ETF Inflows Support Spot Price",
      sentiment: "bullish",
      description: "Individual investors acquire digital gold ETF units, boosting overall underlying assets.",
    }
  ];

  if (Math.random() > 0.6) {
    const selected = newsOptions[Math.floor(Math.random() * newsOptions.length)];
    const newNewsItem: DBMarketNews = {
      id: "news_" + Date.now(),
      title: selected.title,
      sentiment: selected.sentiment as any,
      description: selected.description,
      date: now.toISOString(),
    };
    db.marketPrice.news.unshift(newNewsItem);
    // Keep max 5 news items
    if (db.marketPrice.news.length > 5) {
      db.marketPrice.news.pop();
    }
  }

  saveDatabase(db);
  res.json({
    currentPriceUSD: db.marketPrice.currentPriceUSD,
    lastUpdated: db.marketPrice.lastUpdated,
    news: db.marketPrice.news,
  });
});


// --- VITE MIDDLEWARE SETUP ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'Backend/.env' });
import prisma from '../config/prisma.js';

async function callGeminiApi(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing in environment');

  const models = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-latest',
  ];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      });
      const data = await res.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      if (data.error) {
        console.warn(`Model ${model} error:`, data.error.message);
        lastErr = data.error;
      }
    } catch (e) {
      console.warn(`Model ${model} fetch exception:`, e);
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

async function analyze() {
  const trades: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "AiTradeLog" WHERE cast("createdAt" as date) = '2026-11-19' ORDER BY "createdAt" ASC;`
  );

  console.log(`Fetched ${trades.length} trades for 2026-11-19.`);

  let totalPnl = 0;
  let totalNetPnl = 0;
  let totalCharges = 0;
  let wins = 0;
  let losses = 0;
  const actionCounts: Record<string, number> = {};
  const strategyCounts: Record<string, number> = {};
  const exitReasonCounts: Record<string, number> = {};
  const symbolStats: Record<string, { count: number; pnl: number }> = {};
  let totalHoldingMinutes = 0;

  for (const t of trades) {
    const pnl = Number(t.pnl || 0);
    const net = Number(t.netPnl || pnl);
    const charges = Number(t.charges || 0);
    totalPnl += pnl;
    totalNetPnl += net;
    totalCharges += charges;

    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;

    actionCounts[t.action] = (actionCounts[t.action] || 0) + 1;
    strategyCounts[t.strategy] = (strategyCounts[t.strategy] || 0) + 1;
    const reason = t.exitReason || 'UNKNOWN';
    exitReasonCounts[reason] = (exitReasonCounts[reason] || 0) + 1;

    const stat = symbolStats[t.symbol] || { count: 0, pnl: 0 };
    stat.count++;
    stat.pnl += pnl;
    symbolStats[t.symbol] = stat;

    totalHoldingMinutes += Number(t.holdingMinutes || 0);
  }

  const summary = {
    date: '2026-11-19',
    totalTrades: trades.length,
    wins,
    losses,
    winRatePercent: trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : 0,
    grossPnl: totalPnl.toFixed(2),
    charges: totalCharges.toFixed(2),
    netPnl: totalNetPnl.toFixed(2),
    avgHoldingMinutes: trades.length > 0 ? (totalHoldingMinutes / trades.length).toFixed(1) : 0,
    actionBreakdown: actionCounts,
    strategyBreakdown: strategyCounts,
    exitReasonBreakdown: exitReasonCounts,
    topSymbolsByLoss: Object.entries(symbolStats)
      .sort((a, b) => a[1].pnl - b[1].pnl)
      .slice(0, 10),
  };

  console.log('Summary Statistics:', JSON.stringify(summary, null, 2));

  // Extract a representative sample of 8 trades with full thesis, indicators, entry/exit prices
  const sampleTrades = trades.slice(0, 10).map(t => ({
    orderId: t.orderId,
    symbol: t.symbol,
    action: t.action,
    strike: t.strike,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    pnl: t.pnl,
    exitReason: t.exitReason,
    holdingMinutes: t.holdingMinutes,
    enteredAt: t.enteredAt,
    exitedAt: t.exitedAt,
    aiThesis: t.aiThesis,
    indicators: t.indicators,
  }));

  const prompt = `
You are an expert quantitative hedge-fund algorithmic trading architect and options strategist specializing in Indian National Stock Exchange (NSE) NIFTY/BANKNIFTY index derivatives and Automated AI Trading Systems.

Below is the complete trade log audit and summary for TODAY (2026-11-19) from PostgreSQL table "AiTradeLog":

=== AGGREGATED SUMMARY FOR 2026-11-19 ===
${JSON.stringify(summary, null, 2)}

=== DETAILED SAMPLE TRADE LOG ENTRIES (First 10 of 75) ===
${JSON.stringify(sampleTrades, null, 2)}

=== KEY OBSERVATIONS FROM EXECUTION ENGINE ===
1. The AI took 75 trades between 09:32 AM IST and 09:40 AM IST (less than 8 minutes!).
2. Most trades were SELL (Option Writing / Shorting CE calls) on NIFTY strikes (25300, 25350, 25400, 25450, 25500, 25550, 25600, 25650).
3. The strategy tag was 'ORB_15M' (15-Minute Opening Range Breakout), but it was taking short positions on calls within the first 15-20 minutes of market open.
4. Almost 100% of the trades hit STOP_LOSS within 2-4 minutes of entry, resulting in consecutive losses.
5. In addition, the engine entered multiple trades per second across adjacent strikes of the same underlying (e.g., selling 25300 CE, 25350 CE, 25400 CE, 25450 CE all in a 10-second burst).

Please provide an in-depth, professional algorithmic post-mortem and actionable strategic overhaul:
1. Root Cause Breakdown: Why did the strategy take 75 rapid trades, why were they all SELL CE, and why did they hit STOP_LOSS?
2. Critical Flaws in the Current Logic:
   - Sizing & Strike Spam (entering correlated strikes of the same index simultaneously)
   - Frequency/Cooldown controls (lack of symbol/underlying cooldown after entry or loss)
   - Option Selling vs Buying in Momentum/ORB (Why selling calls on ORB in the morning session is hazardous)
   - Market direction conflict: Did Nifty experience a morning bounce/gap-fill after opening weak?
3. Actionable Strategy & System Changes to Make it Profitable:
   - Specific parameter changes (cooldowns, max trades per underlying, directional lock)
   - When to BUY options vs when to SELL options
   - Proper ORB rule implementation (wait until 09:30 or 15m candle close, trade breakout direction, do not short calls in an oversold opening bounce)
   - Risk management safeguards (max concurrent positions per underlying, max loss per minute/hour)
4. Formulate the concrete code/rule modifications needed in the trading engine.
`;

  console.log('\nSending to Gemini API for deep analysis...');
  const geminiResponse = await callGeminiApi(prompt);
  console.log('\n=================== GEMINI AI ANALYSIS ===================\n');
  console.log(geminiResponse);
  console.log('\n==========================================================\n');
}

analyze()
  .catch(err => {
    console.error('Error during analysis:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

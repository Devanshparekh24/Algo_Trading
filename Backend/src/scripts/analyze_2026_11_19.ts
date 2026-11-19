import prisma from '../config/prisma.js';

async function main() {
  console.log('Querying AiTradeLog for 2026-11-19...');
  
  // 1. Exact SQL query as requested by user
  const rawSqlTrades: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "AiTradeLog" WHERE cast("createdAt" as date) = '2026-11-19' ORDER BY "createdAt" ASC;`
  );
  console.log(`\n--- Raw SQL Results for 2026-11-19: ${rawSqlTrades.length} records ---`);
  console.log(JSON.stringify(rawSqlTrades, null, 2));

  // Query recent trades from TradeOrderMaster
  const recentTrades = await prisma.tradeOrderMaster.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(`\n--- Most Recent 20 TradeOrderMaster records (any date): ---`);
  console.log(recentTrades.map((t: any) => ({
    id: t.id.toString(),
    orderId: t.masterOrderId,
    symbol: t.symbol,
    action: t.action,
    strategy: t.strategy,
    mode: t.mode,
    status: t.status,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    pnl: t.pnl,
    pnlPercent: t.pnlPercent,
    exitReason: t.exitReason,
    createdAt: t.createdAt.toISOString(),
    enteredAt: t.enteredAt.toISOString(),
  })));
}

main()
  .catch(err => {
    console.error('Error running query:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

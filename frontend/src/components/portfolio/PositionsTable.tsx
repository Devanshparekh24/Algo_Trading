import React from 'react';
import { usePositions } from '../../hooks/usePortfolio';

export const PositionsTable: React.FC = () => {
  const { data: positions = [], isLoading, isError, error, refetch, isFetching } = usePositions();

  const formatINR = (val?: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(isNaN(num) ? 0 : num);
  };

  const totalPnL = positions.reduce((acc, pos) => {
    const pnl = parseFloat(String(pos.pnl || pos.m2m || 0));
    return acc + (isNaN(pnl) ? 0 : pnl);
  }, 0);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm animate-pulse text-center text-xs text-gray-400">
        Fetching live positions...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl p-5 border border-red-200 dark:border-red-800 flex justify-between items-center text-xs">
        <span>Failed to fetch positions: {error?.message}</span>
        <button onClick={() => refetch()} className="px-3 py-1.5 bg-red-600 text-white font-semibold rounded-lg shadow">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Positions</h2>
          <p className="text-xs text-gray-400 font-mono">GET /api/v1/portfolio/positions</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <span className="text-[10px] uppercase text-gray-400 font-bold block">Total P&L</span>
            <span className={`text-base font-extrabold font-mono ${totalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatINR(totalPnL)}
            </span>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            title="Refresh Positions"
          >
            <span className={isFetching ? 'animate-spin block' : ''}>🔄</span>
          </button>
        </div>
      </div>

      {/* Positions Table */}
      {positions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700 shadow-sm text-gray-500 text-xs">
          No open positions available.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-400 font-bold uppercase border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Net Qty</th>
                  <th className="py-3 px-4 text-right">Avg Price</th>
                  <th className="py-3 px-4 text-right">LTP</th>
                  <th className="py-3 px-4 text-right">P&L (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-800 dark:text-gray-200 font-medium">
                {positions.map((pos, idx) => {
                  const pnl = parseFloat(String(pos.pnl || pos.m2m || 0));
                  const qty = parseFloat(String(pos.netqty || pos.quantity || 0));

                  return (
                    <tr key={pos.symboltoken || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 dark:text-white text-sm">{pos.tradingsymbol || 'N/A'}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{pos.exchange || 'NSE'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded text-[10px] font-semibold">
                          {pos.producttype || 'DELIVERY'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">{qty}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatINR(pos.averageprice)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">{formatINR(pos.lp)}</td>
                      <td className={`py-3 px-4 text-right font-mono font-bold text-sm ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionsTable;

import React from 'react';
import { History, RefreshCw } from 'lucide-react';
import type { OrderBookItem } from '../../services/aiTradingService';
import { formatINR } from '../../utils/formatters';

interface AiOrderBookTabProps {
  orders: OrderBookItem[];
  isLoadingOrders: boolean;
  onRefreshOrders: () => void;
}

export const AiOrderBookTab: React.FC<AiOrderBookTabProps> = ({
  orders,
  isLoadingOrders,
  onRefreshOrders,
}) => {
  return (
    <div className="space-y-4">
      {/* Tab Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <span>Order Execution Book & Audit Trail</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time status of AI-triggered orders across Paper Simulation and Angel One live accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefreshOrders}
          disabled={isLoadingOrders}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold border border-gray-700 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Orders Content */}
      {orders.length === 0 ? (
        <div className="text-center py-16 bg-gray-900/40 rounded-2xl border border-gray-800">
          <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-300">No Orders Executed Yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Execute a trade signal or let Auto-Pilot place simulated/live orders.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (Hidden on Small Screens) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900/80 shadow-xl">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-950 text-gray-400 uppercase text-[11px] font-semibold border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3">Order ID / Time</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Execution Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80 font-mono">
                {orders.map((o) => {
                  const isBuy = o.transactiontype === 'BUY';
                  const isPaper = o.orderid.startsWith('PAPER_');

                  return (
                    <tr key={o.orderid} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{o.orderid}</div>
                        <div className="text-[10px] text-gray-500">{o.updatetime}</div>
                      </td>
                      <td className="px-4 py-3 font-sans font-semibold text-white">
                        {o.tradingsymbol}
                        <span className="text-[10px] text-gray-500 ml-1 font-mono">
                          {o.exchange}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            isBuy
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {o.transactiontype}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{o.producttype}</td>
                      <td className="px-4 py-3 text-right font-bold text-white font-mono">{o.quantity}</td>
                      <td className="px-4 py-3 text-right font-bold text-white font-mono">
                        {o.price > 0 ? formatINR(o.price) : 'MARKET'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            o.status === 'complete' || o.orderstatus === 'complete'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {o.status || o.orderstatus || 'SUBMITTED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isPaper
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isPaper ? 'PAPER SIM' : 'ANGEL SMARTAPI'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {orders.map((o) => {
              const isBuy = o.transactiontype === 'BUY';
              const isPaper = o.orderid.startsWith('PAPER_');

              return (
                <div
                  key={o.orderid}
                  className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span>{o.tradingsymbol}</span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {o.exchange}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {o.orderid} • {o.updatetime}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                        isBuy
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {o.transactiontype}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-gray-800">
                    <div>
                      <div className="text-[10px] text-gray-500">Qty</div>
                      <div className="font-bold text-white font-mono">{o.quantity}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500">Price</div>
                      <div className="font-bold text-white font-mono">
                        {o.price > 0 ? formatINR(o.price) : 'MARKET'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500">Product</div>
                      <div className="font-medium text-gray-300">{o.producttype}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                        o.status === 'complete' || o.orderstatus === 'complete'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {o.status || o.orderstatus || 'SUBMITTED'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        isPaper
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isPaper ? 'PAPER SIM' : 'ANGEL SMARTAPI'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

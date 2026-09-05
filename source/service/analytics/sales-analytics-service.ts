import { SaleInvoiceModel } from "../../model/sales/sale-invoice-model";
import { toAggregateFilter } from "../../utility/helper/tenant-scope";
import * as reportsService from "../finance/reports-service";
import * as saleInvoiceService from "../sales/sale-invoice-service";
import * as purchaseInvoiceService from "../purchase/purchase-invoice-service";
import { getOrSet, buildCacheKey } from "../../utility/helper/cache";

// Dashboard/Reports hit these with the same tenant+params repeatedly —
// short TTL so it's a staleness/perf tradeoff, never a source-of-truth
// change (a stale KPI for at most this long, never wrong-tenant data).
const CACHE_TTL_SECONDS = 30;

export interface ProfitTrendPoint {
  month: string; // "YYYY-MM"
  revenue: number;
  expenses: number;
  profit: number;
}

// Reuses reports-service's own getProfitAndLoss (the same numbers Finance's
// P&L page shows) once per month for the trailing `months` — a small,
// bounded loop (12 single-aggregate calls, not a heavier one-shot
// aggregation) that guarantees the graph can never drift from the real P&L.
const getProfitTrend = async (
  filter: Record<string, unknown>,
  months = 12
): Promise<ProfitTrendPoint[]> => {
  const points: ProfitTrendPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0));
    const fromDate = monthStart.toISOString().slice(0, 10);
    const toDate = monthEnd.toISOString().slice(0, 10);

    const { totalRevenue, totalExpenses, netProfit } = await reportsService.getProfitAndLoss(filter, { fromDate, toDate });
    points.push({
      month: fromDate.slice(0, 7),
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: netProfit,
    });
  }

  return points;
};

export interface TopProductRow {
  variantId: string;
  sku: string | null;
  productName: string | null;
  qtySold: number;
  revenue: number;
  profit: number;
}

// $unwind + $group straight off Sale Invoice line items — each line already
// carries its own snapshotted costPrice (see sale-invoice-model.ts), so
// profit-per-line is `(price - costPrice) * qty`, no re-derivation needed.
// Cancelled invoices are excluded since their stock/revenue never actually
// left the business.
const getTopProducts = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string; limit?: number } = {}
): Promise<TopProductRow[]> =>
  getOrSet(buildCacheKey("sales-analytics:getTopProducts", filter, options), CACHE_TTL_SECONDS, () =>
    getTopProductsImpl(filter, options)
  );

const getTopProductsImpl = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string; limit?: number } = {}
): Promise<TopProductRow[]> => {
  const dateMatch: Record<string, unknown> = {};
  if (options.fromDate) dateMatch.$gte = new Date(options.fromDate);
  if (options.toDate) {
    const end = new Date(options.toDate);
    end.setUTCHours(23, 59, 59, 999);
    dateMatch.$lte = end;
  }

  const match: Record<string, unknown> = {
    ...toAggregateFilter(filter),
    deliveryStatus: { $ne: "Cancelled" },
    ...(Object.keys(dateMatch).length ? { createdAt: dateMatch } : {}),
  };

  const grouped = await SaleInvoiceModel.aggregate([
    { $match: match },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.variantId",
        productName: { $first: "$products.productName" },
        qtySold: { $sum: "$products.qty" },
        revenue: { $sum: { $multiply: ["$products.qty", "$products.price"] } },
        profit: {
          $sum: {
            $multiply: [
              "$products.qty",
              { $subtract: ["$products.price", { $ifNull: ["$products.costPrice", 0] }] },
            ],
          },
        },
      },
    },
    { $sort: { qtySold: -1 } },
    { $limit: options.limit || 10 },
  ]);

  return grouped.map((g) => ({
    variantId: String(g._id),
    sku: null,
    productName: g.productName || "—",
    qtySold: g.qtySold || 0,
    revenue: Math.round((g.revenue || 0) * 100) / 100,
    profit: Math.round((g.profit || 0) * 100) / 100,
  }));
};

// Same grouping as getTopProducts above, but real page/limit pagination via
// $facet (one aggregate call returns both the total distinct-product count
// and the requested page) — backs the Dashboard/Reports drill-down modal,
// where getTopProducts' own fixed top-10 isn't enough.
const getTopProductsPaginated = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{ totalCount: number; result: TopProductRow[] }> => {
  const dateMatch: Record<string, unknown> = {};
  if (options.fromDate) dateMatch.$gte = new Date(options.fromDate);
  if (options.toDate) {
    const end = new Date(options.toDate);
    end.setUTCHours(23, 59, 59, 999);
    dateMatch.$lte = end;
  }

  const match: Record<string, unknown> = {
    ...toAggregateFilter(filter),
    deliveryStatus: { $ne: "Cancelled" },
    ...(Object.keys(dateMatch).length ? { createdAt: dateMatch } : {}),
  };

  const startIndex = (page - 1) * limit;
  const [facetResult] = await SaleInvoiceModel.aggregate([
    { $match: match },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.variantId",
        productName: { $first: "$products.productName" },
        qtySold: { $sum: "$products.qty" },
        revenue: { $sum: { $multiply: ["$products.qty", "$products.price"] } },
        profit: {
          $sum: {
            $multiply: [
              "$products.qty",
              { $subtract: ["$products.price", { $ifNull: ["$products.costPrice", 0] }] },
            ],
          },
        },
      },
    },
    { $sort: { qtySold: -1 } },
    {
      $facet: {
        data: [{ $skip: startIndex }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const rows = facetResult?.data || [];
  const totalCount = facetResult?.total?.[0]?.count || 0;

  return {
    totalCount,
    result: rows.map((g: any) => ({
      variantId: String(g._id),
      sku: null,
      productName: g.productName || "—",
      qtySold: g.qtySold || 0,
      revenue: Math.round((g.revenue || 0) * 100) / 100,
      profit: Math.round((g.profit || 0) * 100) / 100,
    })),
  };
};

export interface SalesOverview {
  totalInvoices: number;
  totalRevenue: number;
  totalProfit: number;
  totalReceivable: number;
  totalRefundDueToCustomers: number;
  totalPayable: number;
  totalRefundDueFromSuppliers: number;
}

const getOverview = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<SalesOverview> =>
  getOrSet(buildCacheKey("sales-analytics:getOverview", filter, options), CACHE_TTL_SECONDS, () =>
    getOverviewImpl(filter, options)
  );

const getOverviewImpl = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<SalesOverview> => {
  const dateMatch: Record<string, unknown> = {};
  if (options.fromDate) dateMatch.$gte = new Date(options.fromDate);
  if (options.toDate) {
    const end = new Date(options.toDate);
    end.setUTCHours(23, 59, 59, 999);
    dateMatch.$lte = end;
  }
  const match: Record<string, unknown> = {
    ...toAggregateFilter(filter),
    deliveryStatus: { $ne: "Cancelled" },
    ...(Object.keys(dateMatch).length ? { createdAt: dateMatch } : {}),
  };

  const [totals] = await SaleInvoiceModel.aggregate([
    { $match: match },
    { $unwind: "$products" },
    {
      $group: {
        _id: null,
        revenue: { $sum: { $multiply: ["$products.qty", "$products.price"] } },
        profit: {
          $sum: {
            $multiply: [
              "$products.qty",
              { $subtract: ["$products.price", { $ifNull: ["$products.costPrice", 0] }] },
            ],
          },
        },
      },
    },
  ]);
  const totalInvoices = await SaleInvoiceModel.countDocuments(match);

  const receivables = await saleInvoiceService.getReceivables(filter, 1, 1);
  const payables = await purchaseInvoiceService.getPayables(filter, 1, 1);

  return {
    totalInvoices,
    totalRevenue: Math.round((totals?.revenue || 0) * 100) / 100,
    totalProfit: Math.round((totals?.profit || 0) * 100) / 100,
    totalReceivable: receivables.totalBalanceDue,
    totalRefundDueToCustomers: receivables.totalRefundDue,
    totalPayable: payables.totalBalanceDue,
    totalRefundDueFromSuppliers: payables.totalRefundDue,
  };
};

export { getProfitTrend, getTopProducts, getTopProductsPaginated, getOverview };

import { PaymentModel, PaymentDirection } from "../../model/finance/payment-model";
import { BankAccountModel } from "../../model/finance/bank-account-model";
import { CustomerInvoiceModel } from "../../model/finance/customer-invoice-model";
import { VendorBillModel } from "../../model/finance/vendor-bill-model";
import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { ensureAccountsReceivable } from "../../utility/helper/finance-accounts";
import { paymentDto } from "../../utility/dtos/finance/payment-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/payment-mapper";
import { buildSearchCondition } from "../../utility/helper/list-query";
import { createJournalEntry } from "./journal-service";

const POPULATE_FIELDS: [string, string][] = [
  ["bankAccountId", "name"],
  ["invoiceId", "invoiceNumber"],
  ["billId", "billNumber"],
  ["contraAccountId", "code name"],
];

export interface PaymentListOptions {
  search?: string;
  direction?: string;
  bankAccountId?: string;
  fromDate?: string;
  toDate?: string;
}

interface CreatePaymentInput {
  date: string;
  direction: PaymentDirection;
  amount: number;
  method?: string;
  reference?: string;
  party?: string;
  bankAccountId: string;
  invoiceId?: string;
  billId?: string;
  contraAccountId?: string;
}

interface PaymentResult {
  errorCode: "success" | "not_found" | "invalid_data" | "exceeds_balance";
  result: paymentDto | null;
}

// Recording a Payment is the single write path that ever advances an
// invoice/bill's paidToDate or posts its clearing entry — Vendor Bill and
// Customer Invoice "record payment" actions both funnel through this one
// function, so there is exactly one place cash-in/cash-out ever gets
// recorded, never two.
const create = async (
  data: CreatePaymentInput,
  scope: TenantScope,
  createdBy: string
): Promise<PaymentResult> => {
  if (data.invoiceId && data.billId) {
    return { errorCode: "invalid_data", result: null };
  }
  if (data.invoiceId && data.direction !== "receipt") {
    return { errorCode: "invalid_data", result: null };
  }
  if (data.billId && data.direction !== "disbursement") {
    return { errorCode: "invalid_data", result: null };
  }
  if (!data.invoiceId && !data.billId && !data.contraAccountId) {
    return { errorCode: "invalid_data", result: null };
  }

  const bankAccount = await BankAccountModel.findOne({
    _id: data.bankAccountId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  }).lean();
  if (!bankAccount) {
    return { errorCode: "not_found", result: null };
  }
  const bankChartAccountId = String(bankAccount.chartAccountId);

  let party = data.party;
  let journal;

  if (data.invoiceId) {
    const invoice = await CustomerInvoiceModel.findOne({
      _id: data.invoiceId,
      adminId: scope.adminId,
      merchantId: scope.merchantId,
    });
    if (!invoice) {
      return { errorCode: "not_found", result: null };
    }
    const balanceDue = (invoice.total || 0) - (invoice.paidToDate || 0);
    if (data.amount > balanceDue) {
      return { errorCode: "exceeds_balance", result: null };
    }

    const accountsReceivable = await ensureAccountsReceivable(scope, createdBy);
    journal = await createJournalEntry({
      tenant: scope,
      createdBy,
      date: new Date(data.date),
      memo: `Payment received — Invoice ${invoice.invoiceNumber}`,
      lines: [
        { accountId: bankChartAccountId, debit: data.amount, credit: 0 },
        { accountId: String(accountsReceivable._id), debit: 0, credit: data.amount },
      ],
    });

    invoice.paidToDate = (invoice.paidToDate || 0) + data.amount;
    invoice.status = invoice.paidToDate >= (invoice.total || 0) ? "Paid" : "Partial";
    await invoice.save();
    party = party || invoice.customerName || undefined;
  } else if (data.billId) {
    const bill = await VendorBillModel.findOne({
      _id: data.billId,
      adminId: scope.adminId,
      merchantId: scope.merchantId,
    });
    if (!bill) {
      return { errorCode: "not_found", result: null };
    }
    const balanceDue = (bill.total || 0) - (bill.paidToDate || 0);
    if (data.amount > balanceDue) {
      return { errorCode: "exceeds_balance", result: null };
    }

    const accountsPayable = await ChartOfAccountModel.findOne({
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      code: "2000",
    }).lean();
    if (!accountsPayable) {
      throw new Error("Chart of Accounts is missing code 2000 (Accounts Payable) for this tenant.");
    }

    journal = await createJournalEntry({
      tenant: scope,
      createdBy,
      date: new Date(data.date),
      memo: `Payment sent — Bill ${bill.billNumber}`,
      lines: [
        { accountId: String(accountsPayable._id), debit: data.amount, credit: 0 },
        { accountId: bankChartAccountId, debit: 0, credit: data.amount },
      ],
    });

    bill.paidToDate = (bill.paidToDate || 0) + data.amount;
    bill.status = bill.paidToDate >= (bill.total || 0) ? "Paid" : "Partial";
    await bill.save();
    party = party || bill.vendorName || undefined;
  } else {
    const isReceipt = data.direction === "receipt";
    journal = await createJournalEntry({
      tenant: scope,
      createdBy,
      date: new Date(data.date),
      memo: data.reference || undefined,
      lines: [
        { accountId: isReceipt ? bankChartAccountId : (data.contraAccountId as string), debit: data.amount, credit: 0 },
        { accountId: isReceipt ? (data.contraAccountId as string) : bankChartAccountId, debit: 0, credit: data.amount },
      ],
    });
  }

  const payment = await PaymentModel.create({
    date: new Date(data.date),
    direction: data.direction,
    amount: data.amount,
    method: data.method || null,
    reference: data.reference || null,
    party: party || null,
    bankAccountId: bankAccount._id,
    invoiceId: data.invoiceId || null,
    billId: data.billId || null,
    contraAccountId: data.contraAccountId || null,
    journalEntryId: journal._id,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  for (const [field, select] of POPULATE_FIELDS) {
    await payment.populate(field, select);
  }
  return { errorCode: "success", result: mapDbToDto(payment) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: PaymentListOptions = {}
): Promise<{ totalCount: number; result: paymentDto[] }> => {
  const startIndex = (page - 1) * limit;
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);

  const query: Record<string, unknown> = {
    ...filter,
    ...buildSearchCondition(options.search, ["party", "reference"]),
    ...(options.direction ? { direction: options.direction } : {}),
    ...(options.bankAccountId ? { bankAccountId: options.bankAccountId } : {}),
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  const data = await PaymentModel.find(query)
    .populate("bankAccountId", "name")
    .populate("invoiceId", "invoiceNumber")
    .populate("billId", "billNumber")
    .populate("contraAccountId", "code name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await PaymentModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<paymentDto | null> => {
  const data = await PaymentModel.findOne({ _id: id, ...filter })
    .populate("bankAccountId", "name")
    .populate("invoiceId", "invoiceNumber")
    .populate("billId", "billNumber")
    .populate("contraAccountId", "code name")
    .lean();
  return data ? mapDbToDto(data) : null;
};

export { create, getAll, get };

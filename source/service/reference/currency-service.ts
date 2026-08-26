// Static ISO 4217 reference data (no DB, no external package — same
// "static reference data served from the backend" pattern as geo-service.ts)
// so every tenant-currency dropdown in the app (Account.currency, per
// tenant-currency-lock architecture) reads from one real API instead of a
// hardcoded list duplicated into each frontend.

export interface CurrencyOption {
  id: string; // ISO 4217 code — the value actually stored (Account.currency)
  name: string;
  symbol: string;
}

const ALL_CURRENCIES: CurrencyOption[] = [
  { id: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { id: "USD", name: "US Dollar", symbol: "$" },
  { id: "EUR", name: "Euro", symbol: "€" },
  { id: "GBP", name: "British Pound", symbol: "£" },
  { id: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { id: "QAR", name: "Qatari Riyal", symbol: "ر.ق" },
  { id: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
  { id: "BHD", name: "Bahraini Dinar", symbol: ".د.ب" },
  { id: "OMR", name: "Omani Rial", symbol: "ر.ع." },
  { id: "JOD", name: "Jordanian Dinar", symbol: "د.ا" },
  { id: "EGP", name: "Egyptian Pound", symbol: "£" },
  { id: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { id: "INR", name: "Indian Rupee", symbol: "₹" },
  { id: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { id: "LKR", name: "Sri Lankan Rupee", symbol: "₨" },
  { id: "NPR", name: "Nepalese Rupee", symbol: "₨" },
  { id: "AFN", name: "Afghan Afghani", symbol: "؋" },
  { id: "IRR", name: "Iranian Rial", symbol: "﷼" },
  { id: "IQD", name: "Iraqi Dinar", symbol: "ع.د" },
  { id: "TRY", name: "Turkish Lira", symbol: "₺" },
  { id: "ILS", name: "Israeli New Shekel", symbol: "₪" },
  { id: "LBP", name: "Lebanese Pound", symbol: "ل.ل" },
  { id: "SYP", name: "Syrian Pound", symbol: "£" },
  { id: "YER", name: "Yemeni Rial", symbol: "﷼" },
  { id: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { id: "JPY", name: "Japanese Yen", symbol: "¥" },
  { id: "KRW", name: "South Korean Won", symbol: "₩" },
  { id: "HKD", name: "Hong Kong Dollar", symbol: "$" },
  { id: "TWD", name: "New Taiwan Dollar", symbol: "$" },
  { id: "SGD", name: "Singapore Dollar", symbol: "$" },
  { id: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { id: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { id: "THB", name: "Thai Baht", symbol: "฿" },
  { id: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { id: "PHP", name: "Philippine Peso", symbol: "₱" },
  { id: "AUD", name: "Australian Dollar", symbol: "$" },
  { id: "NZD", name: "New Zealand Dollar", symbol: "$" },
  { id: "CAD", name: "Canadian Dollar", symbol: "$" },
  { id: "CHF", name: "Swiss Franc", symbol: "Fr" },
  { id: "SEK", name: "Swedish Krona", symbol: "kr" },
  { id: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { id: "DKK", name: "Danish Krone", symbol: "kr" },
  { id: "PLN", name: "Polish Zloty", symbol: "zł" },
  { id: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { id: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { id: "RON", name: "Romanian Leu", symbol: "lei" },
  { id: "RUB", name: "Russian Ruble", symbol: "₽" },
  { id: "UAH", name: "Ukrainian Hryvnia", symbol: "₴" },
  { id: "ZAR", name: "South African Rand", symbol: "R" },
  { id: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { id: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { id: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { id: "MAD", name: "Moroccan Dirham", symbol: "د.م." },
  { id: "DZD", name: "Algerian Dinar", symbol: "د.ج" },
  { id: "TND", name: "Tunisian Dinar", symbol: "د.ت" },
  { id: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { id: "BRL", name: "Brazilian Real", symbol: "R$" },
  { id: "MXN", name: "Mexican Peso", symbol: "$" },
  { id: "ARS", name: "Argentine Peso", symbol: "$" },
  { id: "CLP", name: "Chilean Peso", symbol: "$" },
  { id: "COP", name: "Colombian Peso", symbol: "$" },
  { id: "PEN", name: "Peruvian Sol", symbol: "S/" },
];

const getCurrencies = (search?: string): CurrencyOption[] => {
  if (!search || !search.trim()) return ALL_CURRENCIES;
  const needle = search.trim().toLowerCase();
  return ALL_CURRENCIES.filter(
    (c) => c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)
  );
};

export { getCurrencies };

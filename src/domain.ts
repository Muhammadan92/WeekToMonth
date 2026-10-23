export type Frequency = "monthly" | "weekly" | "daily";
export type Bucket = "cash" | "reserve" | "savings" | "annual";
export type Item = {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  kind: "fixed" | "variable";
  weekday: number;
};
export type Plan = { payAmount: number; payAnchor: string; items: Item[] };
export type AnnualBill = {
  id: string;
  name: string;
  amount: number;
  month: number;
  day: number;
};
export type Entry = {
  id: string;
  date: string;
  name: string;
  amount: number;
  kind: "income" | "expense" | "transfer";
  bucket: Bucket;
  direction: "in" | "out";
  category: string;
  payday: string;
  billYear?: string;
};
export type Budget = {
  version: 1;
  demo: boolean;
  household: string;
  opening: {
    date: string;
    cash: number;
    savings: number;
    reserve: number;
    annual: number;
  };
  plans: Record<string, Plan>;
  annualBills: AnnualBill[];
  entries: Entry[];
};
export const id = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const date = (s: string) => new Date(`${s}T12:00:00Z`);
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, days: number) => {
  const d = date(s);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
export const shiftMonth = (s: string, n: number) => {
  const d = date(`${s}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d).slice(0, 7);
};
export const daysInMonth = (month: string) =>
  date(addDays(`${shiftMonth(month, 1)}-01`, -1)).getUTCDate();
export const monthEnd = (month: string) => `${month}-${daysInMonth(month)}`;
export const formatDate = (
  s: string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) => date(s).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
export const monthName = (s: string) =>
  formatDate(`${s}-01`, { month: "long", year: "numeric" });
export const money = (cents: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: compact && cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export function toCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a positive amount with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000_000)
    throw new Error("That amount is too large.");
  return result;
}
export function occurrences(item: Item, month: string) {
  if (item.frequency === "monthly") return 1;
  if (item.frequency === "daily") return daysInMonth(month);
  let count = 0;
  for (let day = 1; day <= daysInMonth(month); day++)
    if (
      date(`${month}-${String(day).padStart(2, "0")}`).getUTCDay() ===
      item.weekday
    )
      count++;
  return count;
}
export const itemTotal = (item: Item, month: string) =>
  item.amount * occurrences(item, month);
export function paydays(anchor: string, month: string) {
  const start = `${month}-01`;
  const days = Math.round(
    (date(start).getTime() - date(anchor).getTime()) / 86400000,
  );
  let current = addDays(anchor, Math.ceil(days / 14) * 14);
  const result: string[] = [];
  while (current <= monthEnd(month)) {
    result.push(current);
    current = addDays(current, 14);
  }
  return result;
}
export function nextExtra(anchor: string, from: string) {
  let month = from.slice(0, 7);
  for (let i = 0; i < 24; i++) {
    const days = paydays(anchor, month);
    if (days.length === 3 && days[2] >= from) return days[2];
    month = shiftMonth(month, 1);
  }
  throw new Error("Could not calculate the next extra paycheck.");
}
export function planFor(data: Budget, month: string): Plan {
  const keys = Object.keys(data.plans).sort();
  const key = keys.filter((k) => k <= month).at(-1) ?? keys[0];
  return structuredClone(data.plans[key]);
}
export function balances(data: Budget, through = today()) {
  const result = { cash: 0, savings: 0, reserve: 0, annual: 0, free: 0 };
  if (through < data.opening.date) return result;
  Object.assign(result, data.opening);
  for (const e of data.entries.filter((e) => e.date <= through)) {
    if (e.kind === "income") {
      result.cash += e.amount;
      if (e.bucket !== "cash") result[e.bucket] += e.amount;
    }
    if (e.kind === "expense") {
      result.cash -= e.amount;
      if (e.bucket !== "cash") result[e.bucket] -= e.amount;
    }
    if (e.kind === "transfer" && e.bucket !== "cash")
      result[e.bucket] += e.direction === "in" ? e.amount : -e.amount;
  }
  result.free = result.cash - result.savings - result.reserve - result.annual;
  return result;
}
export function reserveGuide(data: Budget, month: string) {
  const plan = planFor(data, month);
  const cutoff = monthEnd(month) < today() ? monthEnd(month) : today();
  const from = month === today().slice(0, 7) ? today() : `${month}-01`;
  // A recorded third paycheck has already replenished the pot; look beyond it.
  let next = nextExtra(plan.payAnchor, from);
  if (data.entries.some((e) => e.kind === "income" && e.payday === next))
    next = nextExtra(plan.payAnchor, addDays(next, 1));
  const months = Math.max(
    1,
    (Number(next.slice(0, 4)) - Number(month.slice(0, 4))) * 12 +
      Number(next.slice(5, 7)) -
      Number(month.slice(5, 7)),
  );
  const released = data.entries
    .filter(
      (e) =>
        e.date.startsWith(month) &&
        e.kind === "transfer" &&
        e.bucket === "reserve",
    )
    .reduce((n, e) => n + (e.direction === "out" ? e.amount : -e.amount), 0);
  const balance = balances(data, cutoff).reserve;
  const allowance = Math.floor((balance + Math.max(0, released)) / months);
  return {
    next,
    months,
    allowance,
    remaining: Math.min(balance, Math.max(0, allowance - released)),
    released,
    balance,
  };
}
export const annualMonthly = (data: Budget) =>
  Math.ceil(data.annualBills.reduce((sum, b) => sum + b.amount, 0) / 12);
export function annualDue(bill: AnnualBill, month: string) {
  let year = Number(month.slice(0, 4));
  if (bill.month < Number(month.slice(5, 7))) year++;
  const m = `${year}-${String(bill.month).padStart(2, "0")}`;
  return `${m}-${String(Math.min(bill.day, daysInMonth(m))).padStart(2, "0")}`;
}
export function checkEntry(data: Budget, entry: Entry) {
  if (entry.amount <= 0) throw new Error("Enter an amount greater than zero.");
  if (entry.date < data.opening.date)
    throw new Error("Choose a date on or after your opening balances.");
  if (entry.date > today())
    throw new Error(
      "Record actual activity on or before today. Future paychecks stay in your plan.",
    );
  if (entry.payday && data.entries.some((e) => e.payday === entry.payday))
    throw new Error("This paycheck is already recorded.");
  const candidate = { ...data, entries: [...data.entries, entry] };
  for (const day of [...new Set(candidate.entries.map((e) => e.date))].sort()) {
    const b = balances(candidate, day);
    if (b.reserve < 0 || b.annual < 0 || b.savings < 0)
      throw new Error(
        "This would overdraw an earmarked balance. Add funds first or choose everyday cash.",
      );
  }
  if (
    entry.kind === "transfer" &&
    entry.direction === "in" &&
    balances(candidate, entry.date).free < 0
  )
    throw new Error("There is not enough unassigned cash for that transfer.");
}
const validDate = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(date(s).getTime()) &&
  iso(date(s)) === s &&
  s >= "1900-01-01" &&
  s <= "2200-12-31";
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 200;
const cents = (v: unknown): v is number =>
  typeof v === "number" &&
  Number.isSafeInteger(v) &&
  v >= 0 &&
  v <= 100_000_000_000;
const int = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
export function parseBudget(input: unknown): Budget {
  const fail = () => {
    throw new Error(
      "This is not a valid Week to Month backup. Your existing budget has not been changed.",
    );
  };
  if (
    !record(input) ||
    input.version !== 1 ||
    typeof input.demo !== "boolean" ||
    !str(input.household) ||
    !record(input.opening) ||
    !record(input.plans) ||
    !Array.isArray(input.annualBills) ||
    !Array.isArray(input.entries)
  )
    return fail();
  const o = input.opening;
  if (
    !validDate(o.date) ||
    ![o.cash, o.savings, o.reserve, o.annual].every(cents) ||
    Number(o.savings) + Number(o.reserve) + Number(o.annual) > Number(o.cash)
  )
    return fail();
  const plans = Object.entries(input.plans);
  if (
    !plans.length ||
    plans.length > 2400 ||
    input.entries.length > 100000 ||
    input.annualBills.length > 1000
  )
    return fail();
  for (const [month, p] of plans) {
    if (
      !validDate(`${month}-01`) ||
      !record(p) ||
      !cents(p.payAmount) ||
      !validDate(p.payAnchor) ||
      !Array.isArray(p.items) ||
      p.items.length > 1000
    )
      return fail();
    const ids = new Set();
    for (const item of p.items) {
      if (
        !record(item) ||
        !str(item.id) ||
        !item.id ||
        ids.has(item.id) ||
        !str(item.name) ||
        !cents(item.amount) ||
        !["monthly", "weekly", "daily"].includes(String(item.frequency)) ||
        !["fixed", "variable"].includes(String(item.kind)) ||
        !int(item.weekday, 0, 6)
      )
        return fail();
      ids.add(item.id);
    }
  }
  const annualIds = new Set();
  for (const b of input.annualBills) {
    if (
      !record(b) ||
      !str(b.id) ||
      !b.id ||
      annualIds.has(b.id) ||
      !str(b.name) ||
      !cents(b.amount) ||
      !int(b.month, 1, 12) ||
      !int(b.day, 1, 31)
    )
      return fail();
    annualIds.add(b.id);
  }
  const entryIds = new Set();
  const paycheckDates = new Set();
  for (const e of input.entries) {
    if (
      !record(e) ||
      !str(e.id) ||
      !e.id ||
      entryIds.has(e.id) ||
      !validDate(e.date) ||
      e.date < o.date ||
      e.date > today() ||
      !str(e.name) ||
      !cents(e.amount) ||
      e.amount === 0 ||
      !["income", "expense", "transfer"].includes(String(e.kind)) ||
      !["cash", "reserve", "savings", "annual"].includes(String(e.bucket)) ||
      !["in", "out"].includes(String(e.direction)) ||
      !str(e.category) ||
      !str(e.payday) ||
      (e.kind === "transfer" && e.bucket === "cash")
    )
      return fail();
    if (
      e.payday &&
      (!validDate(e.payday) ||
        e.kind !== "income" ||
        paycheckDates.has(e.payday))
    )
      return fail();
    if (
      e.billYear !== undefined &&
      (typeof e.billYear !== "string" ||
        !/^\d{4}$/.test(e.billYear) ||
        Number(e.billYear) < 1900 ||
        Number(e.billYear) > 2200)
    )
      return fail();
    if (e.payday) paycheckDates.add(e.payday);
    entryIds.add(e.id);
  }
  const data = input as unknown as Budget;
  // Validate earmarks in a single ordered pass, including same-day entries as a group.
  let reserve = data.opening.reserve,
    savings = data.opening.savings,
    annual = data.opening.annual,
    cash = data.opening.cash;
  const groups = new Map<string, Entry[]>();
  for (const e of data.entries)
    groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  for (const [, entries] of [...groups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    for (const e of entries) {
      const delta =
        e.amount *
        (e.kind === "expense" ||
        (e.kind === "transfer" && e.direction === "out")
          ? -1
          : 1);
      if (e.kind !== "transfer") cash += delta;
      if (e.bucket === "reserve") reserve += delta;
      if (e.bucket === "savings") savings += delta;
      if (e.bucket === "annual") annual += delta;
    }
    if (
      reserve < 0 ||
      savings < 0 ||
      annual < 0 ||
      ![
        cash,
        reserve,
        savings,
        annual,
        cash - reserve - savings - annual,
      ].every(Number.isSafeInteger)
    )
      return fail();
  }
  return structuredClone(data);
}
export function blankBudget(month = today().slice(0, 7)): Budget {
  return {
    version: 1,
    demo: false,
    household: "Our household",
    opening: {
      date: `${month}-01`,
      cash: 0,
      savings: 0,
      reserve: 0,
      annual: 0,
    },
    plans: { [month]: { payAmount: 0, payAnchor: today(), items: [] } },
    annualBills: [],
    entries: [],
  };
}
export function demoBudget(): Budget {
  const month = today().slice(0, 7),
    start = `${month}-01`;
  const anchor = addDays(start, ((5 - date(start).getUTCDay() + 7) % 7) + 7);
  const items: Item[] = [
    {
      id: "rent",
      name: "Rent & home",
      amount: 165000,
      frequency: "monthly",
      kind: "fixed",
      weekday: 5,
    },
    {
      id: "utilities",
      name: "Utilities",
      amount: 18500,
      frequency: "monthly",
      kind: "fixed",
      weekday: 5,
    },
    {
      id: "internet",
      name: "Internet & phone",
      amount: 9500,
      frequency: "monthly",
      kind: "fixed",
      weekday: 5,
    },
    {
      id: "groceries",
      name: "Groceries",
      amount: 12500,
      frequency: "weekly",
      kind: "variable",
      weekday: 6,
    },
    {
      id: "transport",
      name: "Getting around",
      amount: 4500,
      frequency: "weekly",
      kind: "variable",
      weekday: 1,
    },
    {
      id: "little",
      name: "Little everyday things",
      amount: 800,
      frequency: "daily",
      kind: "variable",
      weekday: 0,
    },
  ];
  const data: Budget = {
    version: 1,
    demo: true,
    household: "Our household",
    opening: {
      date: start,
      cash: 1428000,
      savings: 800000,
      reserve: 240000,
      annual: 78000,
    },
    plans: { [month]: { payAmount: 240000, payAnchor: anchor, items } },
    annualBills: [
      {
        id: "car",
        name: "Car insurance",
        amount: 96000,
        month: Number(shiftMonth(month, 1).slice(5)),
        day: 12,
      },
      {
        id: "membership",
        name: "Annual memberships",
        amount: 18000,
        month: Number(shiftMonth(month, 3).slice(5)),
        day: 5,
      },
      {
        id: "registration",
        name: "Car registration",
        amount: 24000,
        month: Number(shiftMonth(month, 5).slice(5)),
        day: 20,
      },
    ],
    entries: [],
  };
  const add = (
    offset: number,
    name: string,
    amount: number,
    category: string,
  ) => {
    const d = addDays(start, offset);
    if (d <= today())
      data.entries.push({
        id: id(),
        date: d,
        name,
        amount,
        kind: "expense",
        bucket: "cash",
        direction: "out",
        category,
        payday: "",
      });
  };
  add(0, "Monthly rent", 165000, "rent");
  add(2, "Weekly grocery shop", 11265, "groceries");
  add(5, "Internet & phone", 9500, "internet");
  add(8, "Utilities", 17340, "utilities");
  add(10, "Weekly grocery shop", 12840, "groceries");
  add(14, "Fuel & transit", 6820, "transport");
  add(18, "Coffee & everyday things", 9400, "little");
  paydays(anchor, month)
    .filter((d) => d <= today())
    .forEach((d, index) =>
      data.entries.push({
        id: id(),
        date: d,
        name: index === 2 ? "Extra paycheck" : "Paycheck",
        amount: 240000,
        kind: "income",
        bucket: index === 2 ? "reserve" : "cash",
        direction: "in",
        category: "",
        payday: d,
      }),
    );
  return data;
}

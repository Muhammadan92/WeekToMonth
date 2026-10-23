import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annualDue,
  annualMonthly,
  balances,
  blankBudget,
  checkEntry,
  daysInMonth,
  itemTotal,
  nextExtra,
  parseBudget,
  paydays,
  planFor,
  reserveGuide,
  toCents,
  type Entry,
  type Item,
} from "./domain";

const entry = (values: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(),
  date: "2024-01-05",
  name: "Test",
  amount: 10000,
  kind: "income",
  bucket: "cash",
  direction: "in",
  category: "",
  payday: "",
  ...values,
});
const fixture = () => {
  const data = blankBudget("2024-01");
  data.opening = {
    date: "2024-01-01",
    cash: 1000000,
    savings: 200000,
    reserve: 240000,
    annual: 60000,
  };
  data.plans["2024-01"] = {
    payAmount: 240000,
    payAnchor: "2024-01-05",
    items: [],
  };
  return data;
};
test("money parses exact cents without floating point drift and rejects non-money", () => {
  assert.equal(toCents("1.01"), 101);
  assert.equal(toCents("0.29"), 29);
  assert.equal(toCents("100"), 10000);
  assert.equal(toCents("0.1"), 10);
  for (const value of ["-1", "1.001", "NaN", "Infinity", "1e3", ""])
    assert.throws(() => toCents(value));
});
test("daily costs use 28, 29, 30 or 31 actual calendar days", () => {
  const item: Item = {
    id: "x",
    name: "Daily",
    amount: 123,
    frequency: "daily",
    kind: "variable",
    weekday: 1,
  };
  assert.equal(daysInMonth("2024-02"), 29);
  assert.equal(itemTotal(item, "2024-02"), 3567);
  assert.equal(itemTotal(item, "2025-02"), 3444);
  assert.equal(itemTotal(item, "2024-04"), 3690);
  assert.equal(itemTotal(item, "2024-12"), 3813);
});
test("weekly costs count selected weekdays, including five-week months", () => {
  const item: Item = {
    id: "x",
    name: "Weekly",
    amount: 10000,
    frequency: "weekly",
    kind: "variable",
    weekday: 5,
  };
  assert.equal(itemTotal(item, "2024-03"), 50000);
  assert.equal(itemTotal(item, "2024-02"), 40000);
});
test("biweekly calendar finds third paychecks and supports anchor before or after month", () => {
  assert.deepEqual(paydays("2024-01-05", "2024-03"), [
    "2024-03-01",
    "2024-03-15",
    "2024-03-29",
  ]);
  assert.deepEqual(paydays("2024-03-29", "2024-01"), [
    "2024-01-05",
    "2024-01-19",
  ]);
  assert.equal(nextExtra("2024-01-05", "2024-01-01"), "2024-03-29");
  assert.equal(nextExtra("2024-01-05", "2024-03-30"), "2024-08-30");
  const days = Array.from({ length: 12 }, (_, i) =>
    paydays("2021-01-01", `2021-${String(i + 1).padStart(2, "0")}`),
  ).flat();
  assert.equal(days.length, 27); // Some calendars really contain 27 checks; never hardcode 26.
});
test("extra pay increases cash and reserve once; releases do not create cash", () => {
  const data = fixture();
  data.entries.push(
    entry({ kind: "income", bucket: "reserve", amount: 240000 }),
  );
  assert.equal(balances(data, "2024-01-31").cash, 1240000);
  assert.equal(balances(data, "2024-01-31").reserve, 480000);
  data.entries.push(
    entry({
      kind: "transfer",
      bucket: "reserve",
      direction: "out",
      amount: 40000,
    }),
  );
  const b = balances(data, "2024-01-31");
  assert.equal(b.cash, 1240000);
  assert.equal(b.reserve, 440000);
  assert.equal(b.free, 540000);
});
test("reserve spans months before refill and repeated releases cannot inflate allowance", () => {
  const data = fixture();
  const before = reserveGuide(data, "2024-01");
  assert.equal(before.months, 2);
  assert.equal(before.allowance, 120000);
  data.entries.push(
    entry({
      kind: "transfer",
      bucket: "reserve",
      direction: "out",
      amount: 120000,
    }),
  );
  const after = reserveGuide(data, "2024-01");
  assert.equal(after.allowance, 120000);
  assert.equal(after.remaining, 0);
});
test("funded annual payment reduces total cash and annual pot, not free cash", () => {
  const data = fixture();
  const before = balances(data, "2024-01-31");
  data.entries.push(
    entry({ kind: "expense", bucket: "annual", amount: 50000 }),
  );
  const after = balances(data, "2024-01-31");
  assert.equal(after.cash, before.cash - 50000);
  assert.equal(after.annual, 10000);
  assert.equal(after.free, before.free);
});
test("backdated activity cannot overdraw pots later in the ledger", () => {
  const data = fixture();
  data.entries.push(
    entry({
      date: "2024-01-20",
      kind: "transfer",
      bucket: "reserve",
      direction: "out",
      amount: 200000,
    }),
  );
  assert.throws(
    () =>
      checkEntry(
        data,
        entry({
          kind: "transfer",
          bucket: "reserve",
          direction: "out",
          amount: 50000,
        }),
      ),
    /overdraw/,
  );
  assert.throws(
    () =>
      checkEntry(
        data,
        entry({ kind: "transfer", bucket: "savings", amount: 9999999 }),
      ),
    /not enough/,
  );
});
test("duplicate paycheck entries and future transactions are blocked", () => {
  const data = fixture();
  data.entries.push(entry({ payday: "2024-01-05" }));
  assert.throws(
    () => checkEntry(data, entry({ payday: "2024-01-05" })),
    /already recorded/,
  );
  assert.throws(
    () => checkEntry(data, entry({ date: "2199-01-01" })),
    /on or before today/,
  );
});
test("monthly plans inherit, clone on edit, and preserve independently saved future plans", () => {
  const data = fixture();
  const feb = planFor(data, "2024-02");
  feb.payAmount = 300000;
  data.plans["2024-02"] = feb;
  assert.equal(planFor(data, "2024-01").payAmount, 240000);
  assert.equal(planFor(data, "2024-03").payAmount, 300000);
  data.plans["2024-04"] = { ...feb, payAmount: 400000 };
  data.plans["2024-02"].payAmount = 350000;
  assert.equal(planFor(data, "2024-04").payAmount, 400000);
  assert.equal(planFor(data, "2024-03").payAmount, 350000);
});
test("annual provisions round up and February dates clamp correctly", () => {
  const data = fixture();
  data.annualBills = [
    { id: "a", name: "Annual", amount: 10000, month: 2, day: 31 },
  ];
  assert.equal(annualMonthly(data), 834);
  assert.equal(annualDue(data.annualBills[0], "2024-01"), "2024-02-29");
  assert.equal(annualDue(data.annualBills[0], "2024-03"), "2025-02-28");
});
test("backup validation rejects malformed amounts, dates, duplicate records, and broken earmarks", () => {
  const data = fixture();
  assert.deepEqual(parseBudget(JSON.parse(JSON.stringify(data))), data);
  const bad = structuredClone(data);
  bad.opening.date = "2024-02-30";
  assert.throws(() => parseBudget(bad));
  const negative = structuredClone(data);
  negative.opening.cash = -1;
  assert.throws(() => parseBudget(negative));
  const duplicate = structuredClone(data);
  const e = entry({});
  duplicate.entries = [e, e];
  assert.throws(() => parseBudget(duplicate));
  const overdraw = structuredClone(data);
  overdraw.entries = [
    entry({ kind: "expense", bucket: "annual", amount: 60001 }),
  ];
  assert.throws(() => parseBudget(overdraw));
  const invalidYear = structuredClone(data);
  invalidYear.entries = [entry({ billYear: "next" })];
  assert.throws(() => parseBudget(invalidYear));
  const emptyPlans = { ...data, plans: {} };
  assert.throws(() => parseBudget(emptyPlans));
});
test("history totals exclude future records and dates before opening return zero", () => {
  const data = fixture();
  data.entries.push(entry({ date: "2024-02-01", amount: 12345 }));
  assert.equal(balances(data, "2024-01-31").cash, 1000000);
  assert.equal(balances(data, "2024-02-01").cash, 1012345);
  assert.equal(balances(data, "2023-12-31").cash, 0);
});

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coffee,
  Download,
  Ellipsis,
  Home,
  Leaf,
  ListFilter,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  annualDue,
  annualMonthly,
  balances,
  blankBudget,
  checkEntry,
  demoBudget,
  formatDate,
  id,
  itemTotal,
  money,
  monthEnd,
  monthName,
  occurrences,
  parseBudget,
  paydays,
  planFor,
  reserveGuide,
  shiftMonth,
  toCents,
  today,
  type AnnualBill,
  type Bucket,
  type Budget,
  type Entry,
  type Item,
  type Plan,
} from "./domain";

const STORAGE_KEY = "weektomonth.budget.v1";
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const bucketNames = {
  cash: "Everyday cash",
  reserve: "Extra-paycheck reserve",
  savings: "Savings",
  annual: "Annual bills fund",
};
type ModalState =
  | { type: "item"; item?: Item }
  | { type: "annual"; bill?: AnnualBill }
  | { type: "entry"; entry?: Partial<Entry> }
  | { type: "settings" | "start" | "help" | "data" }
  | null;
function readBudget() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      data: raw ? parseBudget(JSON.parse(raw)) : demoBudget(),
      error: "",
    };
  } catch {
    return {
      data: demoBudget(),
      error:
        "We could not read your saved budget. Export the saved file below before restoring a backup or starting fresh. Your saved data has not been overwritten.",
    };
  }
}
function download(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Amount({
  name = "amount",
  value = 0,
  required = true,
}: {
  name?: string;
  value?: number;
  required?: boolean;
}) {
  return (
    <div className="amount-input">
      <span>$</span>
      <input
        name={name}
        aria-label={name === "amount" ? "Amount" : undefined}
        type="number"
        min="0"
        max="1000000000"
        step="0.01"
        defaultValue={value ? (value / 100).toFixed(2) : ""}
        required={required}
        placeholder="0.00"
      />
    </div>
  );
}
function Dialog({
  title,
  subtitle,
  children,
  close,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function EntryForm({
  initial = {},
  data,
  month,
  submit,
}: {
  initial?: Partial<Entry>;
  data: Budget;
  month: string;
  submit: (entry: Entry) => void;
}) {
  const [kind, setKind] = useState<Entry["kind"]>(initial.kind ?? "expense");
  const [bucket, setBucket] = useState<Bucket>(initial.bucket ?? "cash");
  const [category, setCategory] = useState(initial.category ?? "");
  const [formError, setFormError] = useState("");
  const plan = planFor(data, month);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      submit({
        id: id(),
        name: String(f.get("name")).trim(),
        amount: toCents(String(f.get("amount"))),
        date: String(f.get("date")),
        kind,
        bucket,
        direction: f.get("direction") === "out" ? "out" : "in",
        category: kind === "expense" ? category : "",
        payday: initial.payday ?? "",
        ...(f.get("billYear") ? { billYear: String(f.get("billYear")) } : {}),
      });
    } catch (e) {
      setFormError((e as Error).message);
    }
  }
  return (
    <form onSubmit={onSubmit}>
      {formError && (
        <div className="form-error" role="alert">
          {formError}
        </div>
      )}
      <Field label="Activity type">
        <select
          name="kind"
          value={kind}
          disabled={!!initial.payday}
          onChange={(e) => {
            setKind(e.target.value as Entry["kind"]);
            setBucket(e.target.value === "transfer" ? "savings" : "cash");
          }}
        >
          <option value="expense">Money spent</option>
          <option value="income">Money received</option>
          <option value="transfer">Move between pots</option>
        </select>
      </Field>
      <Field label="Description">
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={initial.name}
          placeholder={
            kind === "expense"
              ? "e.g. Weekly grocery shop"
              : kind === "income"
                ? "e.g. Paycheck"
                : "e.g. Monthly savings"
          }
        />
      </Field>
      <div className="form-row">
        <Field label="Amount">
          <Amount value={initial.amount} />
        </Field>
        <Field label="Date">
          <input
            name="date"
            type="date"
            required
            min={data.opening.date}
            max={today()}
            defaultValue={
              initial.date ??
              (month === today().slice(0, 7)
                ? today()
                : monthEnd(month) < today()
                  ? monthEnd(month)
                  : today())
            }
          />
        </Field>
      </div>
      <Field
        label={
          kind === "transfer"
            ? "Pot"
            : kind === "expense"
              ? "Paid from"
              : "Put into"
        }
        hint={
          kind === "transfer"
            ? "Moving money changes what it is reserved for. Your total cash stays the same."
            : undefined
        }
      >
        <select
          name="bucket"
          value={bucket}
          onChange={(e) => setBucket(e.target.value as Bucket)}
        >
          {Object.entries(bucketNames)
            .filter(([key]) => kind !== "transfer" || key !== "cash")
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </Field>
      {kind === "transfer" && (
        <Field label="Direction">
          <select name="direction" defaultValue={initial.direction ?? "in"}>
            <option value="in">Everyday cash → this pot</option>
            <option value="out">This pot → everyday cash</option>
          </select>
        </Field>
      )}
      {kind === "expense" && (
        <Field label="Budget category">
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Uncategorized</option>
            <optgroup label="Monthly budget">
              {plan.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Annual bills">
              {data.annualBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
      )}
      {kind === "expense" &&
        data.annualBills.some((b) => b.id === category) && (
          <Field
            label="Bill year"
            hint="The year this payment covers, including bills paid early."
          >
            <input
              name="billYear"
              type="number"
              min="1900"
              max="2200"
              required
              defaultValue={initial.billYear ?? month.slice(0, 4)}
            />
          </Field>
        )}
      <button className="button primary full" type="submit">
        <Check size={17} /> Save activity
      </button>
    </form>
  );
}
function ItemForm({
  item,
  submit,
  remove,
}: {
  item?: Item;
  submit: (item: Item) => void;
  remove: () => void;
}) {
  const [frequency, setFrequency] = useState(item?.frequency ?? "monthly");
  const [formError, setFormError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          submit({
            id: item?.id ?? id(),
            name: String(f.get("name")).trim(),
            amount: toCents(String(f.get("amount"))),
            frequency,
            kind: f.get("kind") as Item["kind"],
            weekday: Number(f.get("weekday") ?? 5),
          });
        } catch (e) {
          setFormError((e as Error).message);
        }
      }}
    >
      {formError && (
        <div className="form-error" role="alert">
          {formError}
        </div>
      )}
      <Field label="Expense name">
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={item?.name}
          placeholder="e.g. Groceries"
        />
      </Field>
      <div className="form-row">
        <Field label="Amount per occurrence">
          <Amount value={item?.amount} />
        </Field>
        <Field label="Frequency">
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Item["frequency"])}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </Field>
      </div>
      <Field label="Cost type">
        <select name="kind" defaultValue={item?.kind ?? "fixed"}>
          <option value="fixed">Fixed — a regular commitment</option>
          <option value="variable">Variable — a spending allowance</option>
        </select>
      </Field>
      {frequency === "weekly" && (
        <Field
          label="Budget week starts on"
          hint="We count this weekday in the selected month, so four- and five-week months are accurate."
        >
          <select name="weekday" defaultValue={item?.weekday ?? 5}>
            {weekdays.map((day, i) => (
              <option key={day} value={i}>
                {day}
              </option>
            ))}
          </select>
        </Field>
      )}
      {frequency === "daily" && (
        <div className="info-box">
          Your daily amount is multiplied by the actual number of days in each
          month.
        </div>
      )}
      <div className="dialog-actions">
        {item && (
          <button type="button" className="button danger" onClick={remove}>
            <Trash2 size={16} /> Remove
          </button>
        )}
        <button className="button primary" type="submit">
          Save expense <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}

export default function App() {
  const [loaded] = useState(readBudget);
  const [data, setData] = useState(loaded.data);
  const [storageError, setStorageError] = useState(loaded.error);
  const [conflict, setConflict] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [tab, setTab] = useState<"overview" | "activity">("overview");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fn = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setConflict(true);
    };
    window.addEventListener("storage", fn);
    return () => window.removeEventListener("storage", fn);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const plan = planFor(data, month);
  const cutoff = monthEnd(month) < today() ? monthEnd(month) : today();
  const cash = balances(data, cutoff);
  const reserve = reserveGuide(data, month);
  const scheduled = paydays(plan.payAnchor, month);
  const monthlyEntries = data.entries.filter((e) => e.date.startsWith(month));
  const monthlyExpenses = monthlyEntries.filter((e) => e.kind === "expense");
  const plannedCosts = plan.items.reduce(
    (sum, item) => sum + itemTotal(item, month),
    0,
  );
  const annualProvision = annualMonthly(data);
  const monthlyIncome = Math.min(2, scheduled.length) * plan.payAmount;
  const monthlyFunds =
    monthlyIncome + Math.max(0, reserve.released) + reserve.remaining;
  const leftToPlan = monthlyFunds - plannedCosts - annualProvision;
  const actualSpend = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const actualIncome = monthlyEntries
    .filter((e) => e.kind === "income")
    .reduce((sum, e) => sum + e.amount, 0);
  const fundedThisMonth = monthlyEntries
    .filter((e) => e.kind === "transfer" && e.bucket === "annual")
    .reduce((sum, e) => sum + (e.direction === "in" ? e.amount : -e.amount), 0);
  const annualTotal = data.annualBills.reduce(
    (sum, bill) => sum + bill.amount,
    0,
  );
  function open(m: ModalState) {
    setError("");
    setModal(m);
  }
  function save(next: Budget, message: string, recovering = false) {
    try {
      if (conflict)
        throw new Error(
          "This budget changed in another tab. Reload to continue with the latest version.",
        );
      if (loaded.error && storageError && !recovering)
        throw new Error(
          "Restore a backup or start fresh before editing. The unreadable saved budget is protected.",
        );
      const valid = parseBudget(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
        setStorageError("");
      } catch {
        setStorageError(
          "Your changes are only in memory because this browser could not save them. Export a backup before closing this page.",
        );
      }
      setData(valid);
      setModal(null);
      setError("");
      setToast(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this change.");
    }
  }
  function savePlan(next: Plan, message: string) {
    save({ ...data, plans: { ...data.plans, [month]: next } }, message);
  }
  function addEntry(entry: Entry) {
    try {
      checkEntry(data, entry);
      save(
        { ...data, entries: [...data.entries, entry] },
        "Activity recorded. Your balances are up to date.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function transfer(
    bucket: Bucket,
    amount: number,
    direction: "in" | "out",
    name: string,
  ) {
    open({
      type: "entry",
      entry: { kind: "transfer", bucket, amount, direction, name },
    });
  }
  function removeEntry(entry: Entry) {
    if (
      !window.confirm(
        `Remove “${entry.name}”? Its effect on your balances will be reversed.`,
      )
    )
      return;
    save(
      { ...data, entries: data.entries.filter((e) => e.id !== entry.id) },
      "Activity removed and balances recalculated.",
    );
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10_000_000)
        throw new Error("Please choose a backup smaller than 10 MB.");
      const imported = parseBudget(JSON.parse(await file.text()));
      if (
        !window.confirm(
          "Restore this backup? It will replace the budget saved in this browser. Export your current budget first if you need to keep it.",
        )
      )
        return;
      save(imported, "Backup restored.", true);
      setMonth(today().slice(0, 7));
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "This file is not valid JSON. Your current budget is unchanged."
          : (e as Error).message,
      );
    }
  }
  function exportBackup() {
    download(JSON.stringify(data, null, 2), `week-to-month-${today()}.json`);
    setToast("Backup exported. Keep it somewhere safe.");
  }
  const currentMonth = month === today().slice(0, 7);
  const futureMonth = month > today().slice(0, 7);
  const visibleEntries = monthlyEntries
    .filter((e) => filter === "all" || e.kind === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("overview");
            }}
            aria-label="Week to Month home"
          >
            <span className="brand-mark">
              w<span>m</span>
            </span>
            <span>
              week<span className="brand-to">to</span>month
              <span className="brand-dot">.</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <button
              className={tab === "overview" ? "nav-link active" : "nav-link"}
              onClick={() => setTab("overview")}
            >
              Overview
            </button>
            <button
              className={tab === "activity" ? "nav-link active" : "nav-link"}
              onClick={() => setTab("activity")}
            >
              Activity{" "}
              <span className="nav-count">{monthlyEntries.length}</span>
            </button>
          </nav>
          <div className="header-right">
            <span className="local-status">
              <span />{" "}
              {storageError
                ? "Backup needed"
                : data.demo
                  ? "Sample budget"
                  : "Saved on this device"}
            </span>
            <button
              className="icon-button"
              aria-label="Backup and data"
              onClick={() => open({ type: "data" })}
            >
              <Download size={18} />
            </button>
            <button
              className="avatar"
              onClick={() => open({ type: "settings" })}
              aria-label="Household settings"
            >
              {data.household.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </div>
      </header>
      <main className="shell">
        {(storageError || conflict) && (
          <div className="alert" role="alert">
            {conflict
              ? "This budget changed in another tab. Reload before making more changes."
              : storageError}
            <button
              className="text-button"
              onClick={() =>
                conflict ? location.reload() : open({ type: "data" })
              }
            >
              {conflict ? "Reload latest budget" : "Open backup tools"}{" "}
              <ArrowRight size={15} />
            </button>
          </div>
        )}
        {data.demo && (
          <div className="demo-banner">
            <span>
              <Sparkles size={15} />
              <strong>A little preview of a clearer month.</strong> You’re
              exploring sample numbers.
            </span>
            <button onClick={() => open({ type: "start" })}>
              Make it yours <ArrowRight size={15} />
            </button>
          </div>
        )}
        <section className="page-heading">
          <div>
            <div className="eyebrow">YOUR MONEY, AT A CALMER PACE</div>
            <h1>
              {tab === "overview"
                ? "A clearer month starts here."
                : "The little things add up."}
            </h1>
            <p>
              {tab === "overview"
                ? "Biweekly pay. Monthly life. One simple plan."
                : "Every paycheck, purchase, and move between your pots."}
            </p>
          </div>
          <div className="heading-actions">
            <div className="month-control">
              <button
                aria-label="Previous month"
                disabled={month <= data.opening.date.slice(0, 7)}
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                <CalendarDays size={16} />
                {monthName(month)}
              </span>
              <button
                aria-label="Next month"
                disabled={month >= "2199-12"}
                onClick={() => setMonth(shiftMonth(month, 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              className="button primary"
              onClick={() => open({ type: "entry" })}
            >
              <Plus size={17} /> Add activity
            </button>
          </div>
        </section>
        {!currentMonth && (
          <div className="month-note">
            {futureMonth
              ? "Planning ahead. Balances reflect recorded activity through today."
              : `Looking back. Balances reflect recorded activity through ${formatDate(cutoff)}.`}
            <button onClick={() => setMonth(today().slice(0, 7))}>
              Back to this month <ArrowRight size={14} />
            </button>
          </div>
        )}
        <section className="stats-grid" aria-label="Monthly summary">
          <div className="stat">
            <div className="stat-label">
              Monthly spending power <Wallet size={16} />
            </div>
            <strong>{money(monthlyFunds, true)}</strong>
            <span>2 paychecks + reserve allowance</span>
          </div>
          <div className="stat">
            <div className="stat-label">
              Planned for the month <CalendarDays size={16} />
            </div>
            <strong>{money(plannedCosts + annualProvision, true)}</strong>
            <span>Everyday budget + annual set-aside</span>
          </div>
          <div className={`stat accent ${leftToPlan < 0 ? "over" : ""}`}>
            <div className="stat-label">
              {leftToPlan < 0 ? "Over your monthly plan" : "Room in your plan"}{" "}
              <Leaf size={16} />
            </div>
            <strong>{money(Math.abs(leftToPlan), true)}</strong>
            <span>
              {leftToPlan < 0
                ? "Adjust expenses or your income plan"
                : "A little breathing room for what matters"}
            </span>
          </div>
          <div className="stat">
            <div className="stat-label">
              Total cash <ShieldCheck size={16} />
            </div>
            <strong>{money(cash.cash, true)}</strong>
            <span>Includes savings & reserved money</span>
          </div>
        </section>
        <div className="dashboard-grid">
          <div className="main-column">
            <section className="reserve-card" aria-labelledby="reserve-title">
              <div className="reserve-main">
                <div className="reserve-icon">
                  <Sparkles size={23} />
                </div>
                <div>
                  <div className="reserve-eyebrow">
                    LET YOUR EXTRA PAYCHECK GO FURTHER
                  </div>
                  <h2 id="reserve-title">Your extra-paycheck cushion</h2>
                  <p>Set it aside once. Give every month a little extra.</p>
                </div>
                <button
                  className="icon-button"
                  aria-label="How the extra paycheck reserve works"
                  onClick={() => open({ type: "help" })}
                >
                  <CircleHelp size={19} />
                </button>
              </div>
              <div className="reserve-numbers">
                <div>
                  <span>In your reserve</span>
                  <strong>{money(cash.reserve, true)}</strong>
                </div>
                <span className="reserve-arrow">
                  <ArrowRight size={24} />
                </span>
                <div>
                  <span>Suggested monthly top-up</span>
                  <strong>
                    {money(reserve.allowance, true)}
                    <small> / mo</small>
                  </strong>
                </div>
                <div className="reserve-action">
                  <button
                    className="button light"
                    disabled={reserve.remaining <= 0 || futureMonth}
                    onClick={() =>
                      transfer(
                        "reserve",
                        reserve.remaining,
                        "out",
                        "Monthly reserve top-up",
                      )
                    }
                  >
                    {reserve.remaining > 0
                      ? "Release to this month"
                      : "All set for this month"}{" "}
                    <ArrowUpRight size={16} />
                  </button>
                  <span>
                    {reserve.released > 0
                      ? `${money(reserve.released, true)} released this month`
                      : "Your money stays put until you release it"}
                  </span>
                </div>
              </div>
              <div className="reserve-footer">
                <span>
                  <span className="status-dot" />
                  Next extra paycheck{" "}
                  <strong>
                    {formatDate(reserve.next, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </strong>
                </span>
                <span>
                  {reserve.months}{" "}
                  {reserve.months === 1 ? "monthly top-up" : "monthly top-ups"}{" "}
                  to bridge the gap{" "}
                  <button
                    aria-label="Manage extra paycheck reserve"
                    onClick={() =>
                      transfer("reserve", 0, "in", "Add to paycheck reserve")
                    }
                  >
                    <Plus size={14} />
                  </button>
                </span>
              </div>
            </section>
            {tab === "overview" ? (
              <>
                <section className="panel budget-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Your monthly budget</h2>
                      <p>Everyday commitments. A little flexibility.</p>
                    </div>
                    <button
                      className="button small"
                      onClick={() => open({ type: "item" })}
                    >
                      <Plus size={15} /> Add expense
                    </button>
                  </div>
                  <div className="budget-table">
                    <div className="budget-row table-head">
                      <span>EXPENSE</span>
                      <span>HOW OFTEN</span>
                      <span>MONTHLY PLAN</span>
                      <span>SPENT</span>
                      <span />
                    </div>
                    {(["fixed", "variable"] as const).map((kind) => (
                      <div className="budget-group" key={kind}>
                        <div className="group-label">
                          <span className={`group-dot ${kind}`} />
                          {kind === "fixed" ? "Fixed costs" : "Variable costs"}
                          <span>
                            {money(
                              plan.items
                                .filter((i) => i.kind === kind)
                                .reduce((s, i) => s + itemTotal(i, month), 0),
                              true,
                            )}
                          </span>
                        </div>
                        {plan.items
                          .filter((i) => i.kind === kind)
                          .map((item) => {
                            const spent = monthlyExpenses
                                .filter((e) => e.category === item.id)
                                .reduce((s, e) => s + e.amount, 0),
                              total = itemTotal(item, month);
                            return (
                              <div className="budget-row" key={item.id}>
                                <div className="expense-name">
                                  <span className={`expense-icon ${kind}`}>
                                    {kind === "fixed" ? (
                                      <Home size={16} />
                                    ) : (
                                      <Coffee size={16} />
                                    )}
                                  </span>
                                  <div>
                                    <button
                                      onClick={() =>
                                        open({ type: "item", item })
                                      }
                                    >
                                      {item.name}
                                    </button>
                                    <small>
                                      {item.frequency === "monthly"
                                        ? "Monthly commitment"
                                        : `${money(item.amount, true)} × ${occurrences(item, month)} ${item.frequency === "daily" ? "days" : weekdays[item.weekday] + "s"}`}
                                    </small>
                                  </div>
                                </div>
                                <span className={`frequency ${item.frequency}`}>
                                  {item.frequency}
                                </span>
                                <strong>{money(total, true)}</strong>
                                <div
                                  className={
                                    spent > total ? "spent over-text" : "spent"
                                  }
                                >
                                  {money(spent, true)}
                                  <div className="mini-progress">
                                    <span
                                      style={{
                                        width: `${total ? Math.min(100, (spent / total) * 100) : spent ? 100 : 0}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${item.name}`}
                                  onClick={() => open({ type: "item", item })}
                                >
                                  <Ellipsis size={18} />
                                </button>
                              </div>
                            );
                          })}
                        {!plan.items.some((i) => i.kind === kind) && (
                          <button
                            className="empty-row"
                            onClick={() => open({ type: "item" })}
                          >
                            <Plus size={15} /> Add your first {kind} cost
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="budget-total">
                    <span>
                      Everyday budget{" "}
                      <small>Annual bills are set aside separately</small>
                    </span>
                    <strong>{money(plannedCosts, true)}</strong>
                  </div>
                  <div className="panel-foot">
                    <span>
                      <CheckCircle2 size={14} />
                      {data.plans[month]
                        ? "Your plan carries forward to future months"
                        : "Carried forward from your previous plan"}
                    </span>
                    <button
                      className="text-button"
                      disabled={month <= data.opening.date.slice(0, 7)}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Replace this month’s plan with the previous month’s plan? Your recorded activity will stay unchanged.",
                          )
                        )
                          savePlan(
                            planFor(data, shiftMonth(month, -1)),
                            "Previous month’s plan copied.",
                          );
                      }}
                    >
                      <RotateCcw size={13} /> Use previous plan
                    </button>
                  </div>
                </section>
                <section className="panel paycheck-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Your payday rhythm</h2>
                      <p>A paycheck every 14 days. A plan for every one.</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Edit pay schedule"
                      onClick={() => open({ type: "settings" })}
                    >
                      <Settings2 size={18} />
                    </button>
                  </div>
                  <div className="payday-list">
                    {scheduled.map((day, index) => {
                      const paid = data.entries.find((e) => e.payday === day);
                      return (
                        <div
                          className={`payday ${index === 2 ? "extra" : ""}`}
                          key={day}
                        >
                          <span className="payday-date">
                            <small>{formatDate(day, { month: "short" })}</small>
                            {formatDate(day, { day: "2-digit" })}
                          </span>
                          <div>
                            <strong>
                              {index === 2
                                ? "The extra one"
                                : `Paycheck ${index + 1}`}
                            </strong>
                            <span>
                              {index === 2
                                ? "Into your cushion"
                                : "For everyday life"}
                            </span>
                          </div>
                          <div className="payday-end">
                            <strong>
                              {money(paid?.amount ?? plan.payAmount, true)}
                            </strong>
                            {paid ? (
                              <span className="received">
                                <Check size={12} /> Received
                              </span>
                            ) : day > today() ? (
                              <span>Upcoming</span>
                            ) : (
                              <button
                                disabled={
                                  !plan.payAmount || day < data.opening.date
                                }
                                onClick={() =>
                                  open({
                                    type: "entry",
                                    entry: {
                                      kind: "income",
                                      name:
                                        index === 2
                                          ? "Extra paycheck"
                                          : "Paycheck",
                                      amount: plan.payAmount,
                                      bucket: index === 2 ? "reserve" : "cash",
                                      date: day,
                                      payday: day,
                                    },
                                  })
                                }
                              >
                                Record pay <Plus size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="panel-foot">
                    <span>Paycheck amounts are take-home pay.</span>
                    <button
                      className="text-button"
                      onClick={() => open({ type: "settings" })}
                    >
                      Edit income <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <section className="panel activity-panel">
                <div className="panel-header">
                  <div>
                    <h2>This month’s activity</h2>
                    <p>
                      {money(actualIncome, true)} received ·{" "}
                      {money(actualSpend, true)} spent
                    </p>
                  </div>
                  <div className="filter">
                    <ListFilter size={15} />
                    <select
                      aria-label="Filter activity"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All activity</option>
                      <option value="expense">Spending</option>
                      <option value="income">Income</option>
                      <option value="transfer">Transfers</option>
                    </select>
                  </div>
                </div>
                {visibleEntries.length ? (
                  visibleEntries.map((entry) => (
                    <div className="activity-row" key={entry.id}>
                      <span className={`activity-icon ${entry.kind}`}>
                        {entry.kind === "expense" ? (
                          <ArrowUpRight size={18} />
                        ) : entry.kind === "income" ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowRight size={18} />
                        )}
                      </span>
                      <div className="activity-description">
                        <strong>{entry.name}</strong>
                        <span>
                          {formatDate(entry.date)} · {bucketNames[entry.bucket]}
                          {entry.kind === "transfer"
                            ? ` · ${entry.direction === "in" ? "set aside" : "released"}`
                            : ""}
                        </span>
                      </div>
                      <strong
                        className={entry.kind === "income" ? "income-text" : ""}
                      >
                        {entry.kind === "expense"
                          ? "−"
                          : entry.kind === "income"
                            ? "+"
                            : ""}
                        {money(entry.amount, true)}
                      </strong>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${entry.name}`}
                        onClick={() => removeEntry(entry)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Wallet size={30} />
                    <h3>A fresh page for your month.</h3>
                    <p>
                      Add a purchase, record a paycheck, or move money into
                      savings.
                    </p>
                    <button
                      className="button"
                      onClick={() => open({ type: "entry" })}
                    >
                      <Plus size={16} /> Add your first activity
                    </button>
                  </div>
                )}
              </section>
            )}
            <section className="panel cash-panel">
              <div className="panel-header">
                <div>
                  <h2>A home for every dollar</h2>
                  <p>One total. Clear purposes. No double counting.</p>
                </div>
                <span className="badge">{data.household}</span>
              </div>
              <div className="cash-bar" aria-hidden="true">
                {(["savings", "reserve", "annual", "free"] as const).map(
                  (key) => (
                    <span
                      key={key}
                      className={`bar-${key}`}
                      style={{ flex: Math.max(0, cash[key]) || 0.001 }}
                    />
                  ),
                )}
              </div>
              <div className="cash-pots">
                <div>
                  <span>
                    <i className="dot-free" />
                    Everyday cash
                  </span>
                  <strong className={cash.free < 0 ? "over-text" : ""}>
                    {money(cash.free, true)}
                  </strong>
                  <small>Unassigned, before upcoming bills</small>
                </div>
                <button
                  onClick={() =>
                    transfer("savings", 0, "in", "Move to savings")
                  }
                >
                  <span>
                    <i className="dot-savings" />
                    Savings <Plus size={13} />
                  </span>
                  <strong>{money(cash.savings, true)}</strong>
                  <small>For your bigger picture</small>
                </button>
                <div>
                  <span>
                    <i className="dot-reserve" />
                    Paycheck reserve
                  </span>
                  <strong>{money(cash.reserve, true)}</strong>
                  <small>Smoothing the months</small>
                </div>
                <button
                  onClick={() =>
                    transfer("annual", 0, "in", "Annual bills set-aside")
                  }
                >
                  <span>
                    <i className="dot-annual" />
                    Annual bills <Plus size={13} />
                  </span>
                  <strong>{money(cash.annual, true)}</strong>
                  <small>Ready for later</small>
                </button>
              </div>
              {cash.free < 0 && (
                <div className="inline-warning">
                  Your earmarked pots exceed your cash. Review spending or
                  release money from a pot.
                </div>
              )}
              <div className="panel-foot">
                <span>
                  As of {formatDate(cutoff)} · balances from recorded activity
                </span>
                <button
                  className="text-button"
                  onClick={() =>
                    open({
                      type: "entry",
                      entry: {
                        kind: "transfer",
                        bucket: "savings",
                        name: "Move between pots",
                      },
                    })
                  }
                >
                  Move money <ArrowRight size={14} />
                </button>
              </div>
            </section>
          </div>
          <aside className="annual-column">
            <section
              className="panel annual-panel"
              id="annual-bills"
              tabIndex={-1}
            >
              <div className="annual-heading">
                <span className="annual-icon">
                  <CalendarDays size={20} />
                </span>
                <span className="eyebrow">OUT OF SIGHT? NOT HERE.</span>
              </div>
              <h2>The once-a-year things.</h2>
              <p className="annual-intro">
                A small monthly habit.
                <br />
                Fewer surprises down the road.
              </p>
              <div className="annual-set-aside">
                <span>Set aside each month</span>
                <strong>
                  {money(annualProvision, true)}
                  <small> / mo</small>
                </strong>
                <div className="annual-progress">
                  <span
                    style={{
                      width: `${annualTotal ? Math.min(100, (cash.annual / annualTotal) * 100) : 0}%`,
                    }}
                  />
                </div>
                <small>
                  {money(cash.annual, true)} saved of {money(annualTotal, true)}{" "}
                  yearly
                </small>
                <button
                  className="button full"
                  disabled={annualProvision <= fundedThisMonth || futureMonth}
                  onClick={() =>
                    transfer(
                      "annual",
                      Math.max(0, annualProvision - fundedThisMonth),
                      "in",
                      "Monthly annual-bills set-aside",
                    )
                  }
                >
                  {annualProvision > 0 && fundedThisMonth >= annualProvision ? (
                    <>
                      <Check size={15} /> Set aside this month
                    </>
                  ) : (
                    <>
                      Set aside this month <ArrowDownToLine size={15} />
                    </>
                  )}
                </button>
              </div>
              <div className="annual-list-label">
                COMING UP{" "}
                <span>
                  {data.annualBills.length}{" "}
                  {data.annualBills.length === 1 ? "bill" : "bills"}
                </span>
              </div>
              <div className="annual-list">
                {[...data.annualBills]
                  .sort((a, b) =>
                    annualDue(a, month).localeCompare(annualDue(b, month)),
                  )
                  .map((bill) => {
                    const due = annualDue(bill, month),
                      year = due.slice(0, 4),
                      paid = data.entries
                        .filter(
                          (e) =>
                            e.kind === "expense" &&
                            e.date <= cutoff &&
                            e.category === bill.id &&
                            (e.billYear ?? e.date.slice(0, 4)) === year,
                        )
                        .reduce((sum, e) => sum + e.amount, 0),
                      remaining = Math.max(0, bill.amount - paid),
                      dueMonth = due.slice(0, 7) === month;
                    return (
                      <div className="annual-bill" key={bill.id}>
                        <div>
                          <button
                            className="bill-name"
                            onClick={() => open({ type: "annual", bill })}
                          >
                            {bill.name}
                          </button>
                          <strong>{money(bill.amount, true)}</strong>
                        </div>
                        <div>
                          <span
                            className={dueMonth && remaining ? "due-soon" : ""}
                          >
                            {remaining === 0 ? (
                              <>
                                <Check size={12} /> Paid for {year}
                              </>
                            ) : (
                              `Due ${formatDate(due, { month: "short", day: "numeric", year: "numeric" })}`
                            )}
                          </span>
                          <span>
                            {money(Math.ceil(bill.amount / 12), true)}/mo
                          </span>
                        </div>
                        {remaining > 0 && (
                          <button
                            className="bill-pay"
                            onClick={() =>
                              open({
                                type: "entry",
                                entry: {
                                  kind: "expense",
                                  name: bill.name,
                                  category: bill.id,
                                  billYear: year,
                                  amount: remaining,
                                  bucket:
                                    cash.annual >= remaining
                                      ? "annual"
                                      : "cash",
                                },
                              })
                            }
                          >
                            Record payment <ArrowUpRight size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                {!data.annualBills.length && (
                  <p className="annual-empty">
                    Insurance, memberships, registrations… give those
                    easy-to-forget bills a place.
                  </p>
                )}
              </div>
              <button
                className="add-annual"
                onClick={() => open({ type: "annual" })}
              >
                <Plus size={16} /> Add an annual bill
              </button>
              <div className="annual-note">
                <Leaf size={16} />
                <span>
                  Annual bills stay in view as you plan, month after month. Due
                  soon? You can set aside extra.
                </span>
              </div>
            </section>
            <div className="quiet-note">
              <ShieldCheck size={17} />
              <p>
                Just your numbers. Just your device.
                <br />
                <button onClick={() => open({ type: "data" })}>
                  Keep a backup for peace of mind <ArrowUpRight size={12} />
                </button>
              </p>
            </div>
          </aside>
        </div>
        <footer className="footer">
          <span>
            week<span>to</span>month.{" "}
            <span className="footer-tagline">
              A little clarity goes a long way.
            </span>
          </span>
          <button onClick={() => open({ type: "help" })}>
            <CircleHelp size={14} /> How it works
          </button>
        </footer>
      </main>
      <a className="annual-shortcut" href="#annual-bills">
        <CalendarDays size={16} />
        <span>Annual bills</span>
        <strong>{money(annualProvision, true)}/mo</strong>
        <ArrowRight size={15} />
      </a>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {error && !modal && (
        <div className="error-toast" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <Dialog
          close={() => {
            setModal(null);
            setError("");
          }}
          title={
            modal.type === "item"
              ? modal.item
                ? "Edit budget expense"
                : "Give an expense a home"
              : modal.type === "annual"
                ? modal.bill
                  ? "Edit annual bill"
                  : "Remember it once. Plan all year."
                : modal.type === "entry"
                  ? "A little update to your money"
                  : modal.type === "start"
                    ? "Make room for your real life."
                    : modal.type === "settings"
                      ? "Your household & pay rhythm"
                      : modal.type === "data"
                        ? "Your budget belongs to you."
                        : "Biweekly pay. Monthly clarity."
          }
          subtitle={
            modal.type === "start"
              ? "Start with today’s balances and your next or recent payday. Sample data will be replaced."
              : modal.type === "settings"
                ? `Income changes apply to ${monthName(month)} and carry forward until the next saved plan.`
                : undefined
          }
        >
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {modal.type === "entry" && (
            <EntryForm
              initial={modal.entry}
              data={data}
              month={month}
              submit={addEntry}
            />
          )}
          {modal.type === "item" && (
            <ItemForm
              item={modal.item}
              submit={(item) =>
                savePlan(
                  {
                    ...plan,
                    items: modal.item
                      ? plan.items.map((i) => (i.id === item.id ? item : i))
                      : [...plan.items, item],
                  },
                  "Monthly budget updated.",
                )
              }
              remove={() =>
                savePlan(
                  {
                    ...plan,
                    items: plan.items.filter((i) => i.id !== modal.item?.id),
                  },
                  "Expense removed from this month’s plan. Recorded spending is kept.",
                )
              }
            />
          )}
          {modal.type === "annual" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const bill: AnnualBill = {
                    id: modal.bill?.id ?? id(),
                    name: String(f.get("name")).trim(),
                    amount: toCents(String(f.get("amount"))),
                    month: Number(f.get("month")),
                    day: Number(f.get("day")),
                  };
                  save(
                    {
                      ...data,
                      annualBills: modal.bill
                        ? data.annualBills.map((b) =>
                            b.id === bill.id ? bill : b,
                          )
                        : [...data.annualBills, bill],
                    },
                    "Annual bill saved.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Field label="Bill name">
                <input
                  name="name"
                  required
                  maxLength={100}
                  placeholder="e.g. Car insurance"
                  defaultValue={modal.bill?.name}
                />
              </Field>
              <Field label="Yearly amount">
                <Amount value={modal.bill?.amount} />
              </Field>
              <div className="form-row">
                <Field label="Due month">
                  <select
                    name="month"
                    defaultValue={
                      modal.bill?.month ?? Number(month.slice(5, 7))
                    }
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {formatDate(
                          `2026-${String(i + 1).padStart(2, "0")}-01`,
                          { month: "long" },
                        )}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Day of month">
                  <input
                    name="day"
                    required
                    type="number"
                    min="1"
                    max="31"
                    defaultValue={modal.bill?.day ?? 1}
                  />
                </Field>
              </div>
              <p className="form-hint">
                The monthly set-aside is the yearly total divided by 12, rounded
                up to the nearest cent. For a bill due soon, add extra to its
                fund. Dates beyond a month’s end use its last day.
              </p>
              <div className="dialog-actions">
                {modal.bill && (
                  <button
                    className="button danger"
                    type="button"
                    onClick={() =>
                      save(
                        {
                          ...data,
                          annualBills: data.annualBills.filter(
                            (b) => b.id !== modal.bill?.id,
                          ),
                        },
                        "Annual bill removed. Recorded payments are kept.",
                      )
                    }
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                )}
                <button className="button primary" type="submit">
                  Save annual bill <Check size={16} />
                </button>
              </div>
            </form>
          )}
          {(modal.type === "start" || modal.type === "settings") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const payAmount = toCents(String(f.get("payAmount"))),
                    payAnchor = String(f.get("payAnchor")),
                    household = String(f.get("household")).trim();
                  if (modal.type === "start") {
                    const fresh = blankBudget();
                    fresh.household = household;
                    fresh.opening = {
                      date: String(f.get("openingDate")),
                      cash: toCents(String(f.get("cash") || "0")),
                      savings: toCents(String(f.get("savings") || "0")),
                      reserve: toCents(String(f.get("reserve") || "0")),
                      annual: toCents(String(f.get("annual") || "0")),
                    };
                    if (
                      fresh.opening.savings +
                        fresh.opening.reserve +
                        fresh.opening.annual >
                      fresh.opening.cash
                    )
                      throw new Error(
                        "Your savings and reserved amounts must fit inside total cash. Total cash includes all these pots.",
                      );
                    fresh.plans = {
                      [fresh.opening.date.slice(0, 7)]: {
                        payAmount,
                        payAnchor,
                        items: [],
                      },
                    };
                    if (
                      !data.demo &&
                      !window.confirm(
                        "Start a new budget? This replaces your current budget on this device. Export a backup first if you need it.",
                      )
                    )
                      return;
                    save(
                      fresh,
                      "Your fresh start is ready. Add your expenses and annual bills next.",
                      true,
                    );
                    setMonth(today().slice(0, 7));
                  } else
                    save(
                      {
                        ...data,
                        household,
                        plans: {
                          ...data.plans,
                          [month]: { ...plan, payAmount, payAnchor },
                        },
                      },
                      "Household and income plan updated.",
                    );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Field label="Household name">
                <input
                  name="household"
                  required
                  maxLength={60}
                  defaultValue={
                    modal.type === "start" ? "Our household" : data.household
                  }
                />
              </Field>
              <div className="form-row">
                <Field label="Take-home pay per paycheck">
                  <Amount
                    name="payAmount"
                    value={modal.type === "start" ? 0 : plan.payAmount}
                  />
                </Field>
                <Field
                  label="One regular payday"
                  hint="Any known payday; repeats every 14 days."
                >
                  <input
                    name="payAnchor"
                    required
                    type="date"
                    min="1900-01-01"
                    max="2199-12-31"
                    defaultValue={
                      modal.type === "start" ? today() : plan.payAnchor
                    }
                  />
                </Field>
              </div>
              {modal.type === "start" ? (
                <>
                  <div className="form-divider">YOUR STARTING BALANCES</div>
                  <Field
                    label="Balance date"
                    hint="Use balances before any activity you will record on this date."
                  >
                    <input
                      type="date"
                      name="openingDate"
                      required
                      min="1900-01-01"
                      max={today()}
                      defaultValue={today()}
                    />
                  </Field>
                  <Field
                    label="Total cash across your accounts"
                    hint="Include savings and reserved money in this total."
                  >
                    <Amount name="cash" required={false} />
                  </Field>
                  <div className="form-row">
                    <Field label="Of that: savings">
                      <Amount name="savings" required={false} />
                    </Field>
                    <Field label="Of that: extra-paycheck reserve">
                      <Amount name="reserve" required={false} />
                    </Field>
                  </div>
                  <Field label="Of that: annual bills fund">
                    <Amount name="annual" required={false} />
                  </Field>
                </>
              ) : (
                <div className="info-box">
                  Your opening total was {money(data.opening.cash, true)} on{" "}
                  {formatDate(data.opening.date)}. Record income, spending, and
                  transfers to keep your current balances accurate.
                </div>
              )}
              <button className="button primary full" type="submit">
                {modal.type === "start"
                  ? "Start my monthly plan"
                  : "Save settings"}{" "}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {modal.type === "data" && (
            <div className="data-tools">
              <div className="info-box">
                Your budget is stored in this browser on this device. It does
                not sync between people, devices, or browsers. Clearing browser
                data removes it. Export a backup regularly.
              </div>
              <button className="data-action" onClick={exportBackup}>
                <Download size={21} />
                <span>
                  <strong>Export your budget</strong>
                  <small>
                    All plans, balances, and activity in a JSON backup.
                  </small>
                </span>
                <ArrowRight size={17} />
              </button>
              <button
                className="data-action"
                onClick={() => importRef.current?.click()}
              >
                <Upload size={21} />
                <span>
                  <strong>Restore a backup</strong>
                  <small>Move your budget here or recover a saved copy.</small>
                </span>
                <ArrowRight size={17} />
              </button>
              {loaded.error && (
                <button
                  className="button"
                  onClick={() =>
                    download(
                      localStorage.getItem(STORAGE_KEY) ?? "",
                      "week-to-month-original-data.json",
                    )
                  }
                >
                  Export original unreadable data
                </button>
              )}
              <button
                className="data-action"
                onClick={() => open({ type: "start" })}
              >
                <Plus size={21} />
                <span>
                  <strong>Start a fresh budget</strong>
                  <small>Set your own opening balances and pay schedule.</small>
                </span>
                <ArrowRight size={17} />
              </button>
              <p className="form-hint">
                Backups contain your financial information. Store them somewhere
                private.
              </p>
            </div>
          )}
          {modal.type === "help" && (
            <div className="help-content">
              <div>
                <span>01</span>
                <h3>Two paychecks cover the ordinary month.</h3>
                <p>
                  Enter your take-home pay and one payday. We follow that date
                  every 14 days. The first two checks form your monthly base; a
                  third goes into your reserve when you record it.
                </p>
              </div>
              <div>
                <span>02</span>
                <h3>The extra one becomes breathing room.</h3>
                <p>
                  Your reserve is divided over the months before the next third
                  paycheck. The refill month is excluded unless it is the
                  current month. Each top-up is a suggestion: release it when
                  you need it. Amounts round down to cents, so the reserve is
                  never overdrawn.
                </p>
              </div>
              <div>
                <span>03</span>
                <h3>Plans carry forward. Activity stays put.</h3>
                <p>
                  Each month inherits the latest earlier plan. Editing a month
                  saves its own version; later months with saved plans keep
                  them. Weekly costs count the chosen weekday. Daily costs count
                  calendar days.
                </p>
              </div>
              <div>
                <span>04</span>
                <h3>One total, with clear purposes.</h3>
                <p>
                  Savings, the paycheck reserve, and annual bills are portions
                  of your total cash. Transfers only change the purpose.
                  Spending and income change the total. “Room in your plan” is a
                  forecast, not your bank balance.
                </p>
              </div>
              <div>
                <span>05</span>
                <h3>A small habit for the once-a-year things.</h3>
                <p>
                  Annual amounts are spread over 12 months, rounded up to cents.
                  Set aside more if a bill is coming up before its fund is
                  ready. Record the payment when it happens. No spending,
                  income, or transfers happen automatically.
                </p>
              </div>
            </div>
          )}
        </Dialog>
      )}
      <input
        type="file"
        accept="application/json,.json"
        ref={importRef}
        hidden
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </>
  );
}

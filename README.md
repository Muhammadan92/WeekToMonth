# Week to Month

A calm, responsive household budget that turns biweekly pay into a monthly plan. Built with React, TypeScript, and Vite for a static Vercel deployment.

**Live app:** https://week-to-month.vercel.app

## Use it

The first visit opens an explicitly labeled sample budget. Choose **Make it yours**, enter take-home pay and one regular payday, then enter your opening cash balances. Total cash includes savings, the extra-paycheck reserve, and the annual bills fund. Opening balances should be before any activity you intend to record on that date.

- Add fixed and variable expenses with monthly, weekly, or daily schedules.
- Record paychecks from the payday timeline. The third check in a calendar month defaults to the reserve.
- Release part of the reserve to the monthly plan when needed.
- Record purchases under the matching budget category.
- Set money aside for annual bills and record their payments. The bill year supports early payments for next year's bills.
- Use the month arrows to plan ahead or review history. Plans inherit from the latest earlier month; editing a month creates its own snapshot. Already-saved later plans remain independent.
- Move money between everyday cash and savings or other pots without changing total cash.
- Export and restore JSON backups from the header's download button.

Annual bills stay pinned on desktop. On phones a persistent bottom shortcut shows the monthly set-aside and links to the annual panel.

## Accounting rules

All stored monetary values are integer cents in USD. Amount inputs are parsed as decimal strings. There is no floating-point currency accumulation.

The app calculates real pay dates at 14-day intervals from the anchor payday, including years that contain 27 checks. The first two checks form the base monthly forecast. The third paycheck is extra. Recording it increases both total cash and the reserve; releasing it changes only the allocation.

The suggested reserve allowance divides the remaining reserve (plus releases already recorded in the selected month) over the months before the next unrecorded third paycheck. The refill month is excluded unless it is the selected month, in which case one release is used. Allowances round down to cents; any remainder stays in the reserve. This is a monthly envelope convention, not a day-prorated cash-flow forecast. The app suggests transfers but never silently records them. Changes to the reserve or payday calendar can change the suggestion.

Weekly amounts multiply by the count of the selected weekday in the selected month. Daily amounts multiply by the actual calendar days, including leap years. Monthly amounts occur once. Annual set-asides use the combined yearly total divided by 12, rounded up to cents; per-bill rounded displays may differ by pennies from the combined total. A bill due soon can need an additional manual set-aside.

Total cash = opening cash + received income − recorded spending. Savings, reserve, and annual funds are earmarks within total cash, not extra assets. Everyday cash = total cash − all earmarks. “Room in your plan” is a forecast after planned recurring costs and annual set-asides, not a bank balance. Actual income and spending remain available in Activity. Spending from everyday cash may make it negative; the UI shows a warning so real spending can still be tracked. Earmarked pots cannot be overdrawn.

Recorded balances use activity through the selected month end, capped at today. Future months show current cash rather than pretending scheduled income has arrived. Entries cannot be future-dated. Bank holidays and employer payday shifts are not predicted; adjust the actual received date when recording a paycheck while retaining its scheduled paycheck identity. There is one biweekly income schedule per monthly plan; additional income can be recorded manually.

## Data and privacy

This version is local-first: one browser profile and one origin, using `localStorage`. There is no server database, authentication, bank integration, analytics, or cloud synchronization. Family members on different devices do **not** share a live budget. Backups are the supported transfer/recovery mechanism. Preview and production domains have separate storage. Use the stable production domain for the real budget.

Invalid imported files are rejected before replacement. Unreadable saved data is preserved until explicit recovery. Cross-tab changes block writes until reload to reduce accidental overwrites. If browser persistence fails, changes stay in memory and a warning asks for a backup. Clearing site/browser data removes the budget. Backup files contain financial information and should be stored privately.

## Development

Requires Node.js 22.13+ (24 recommended).

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:browser
```

Browser tests use installed Google Chrome. The Playwright configuration starts a local Vite server. Screenshots are written to ignored `artifacts/`. Domain tests cover exact-cent math, leap years, weekly counts, 27-paycheck years, reserve releases, annual funds, historical balances, month snapshots, and invalid backups. Browser tests cover setup, actual activity, carryover, persistence, responsive layout, backup validation, and storage conflict handling.

## Deployment

Vercel detects Vite; `vercel.json` provides build/output settings and security headers. There are no required environment variables or paid database services. The personal deployment is `week-to-month` in the `muhammad-husayns-projects` Hobby team.

The initial production deployment was published successfully through the CLI. The GitHub source and Actions checks are live, but automatic Vercel deployments are not connected yet: the Vercel API reports that the GitHub integration must be installed. Install or configure the [Vercel GitHub App](https://github.com/apps/vercel) for this repository, then connect `Muhammadan92/WeekToMonth` in [Project Settings → Git](https://vercel.com/muhammad-husayns-projects/week-to-month/settings/git), using `main` as production. Until then, publish with `vercel --prod --scope muhammad-husayns-projects` from this linked checkout.

Initial verification: 13 calculation tests, four Chrome browser flows, successful GitHub CI, and a production Chrome smoke check (HTTP 200, setup opens, no browser runtime errors).

Vercel Hobby is limited to personal, non-commercial use. A commercial white-label offering needs an appropriate paid hosting plan: <https://vercel.com/docs/limits/fair-use-guidelines>.

## Path to a shared or white-label app

The pure calculation and validation module (`src/domain.ts`) is separated from the UI (`src/App.tsx`), with a versioned export schema. A future release should add authenticated household membership, a server-side ledger with transactional writes, conflict resolution, migration/import, and backup recovery before promising multi-device sync. Extract a configurable brand/theme layer, add currency and locale settings, and package an installable web app or mobile shell. Those capabilities are intentionally not claimed by this first local-first release.

import { expect, test } from "@playwright/test";

test("complete household flow, month carryover, reserve accounting and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Make it yours" }).click();
  await page.getByLabel("Take-home pay per paycheck").fill("2500");
  await page.getByLabel("Total cash across your accounts").fill("10000");
  await page.getByLabel("Of that: savings").fill("4000");
  await page.getByLabel("Of that: extra-paycheck reserve").fill("2000");
  await page.getByLabel("Of that: annual bills fund").fill("600");
  await page.getByRole("button", { name: "Start my monthly plan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("You’re exploring sample numbers.")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByLabel("Expense name").fill("Rent");
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("1500");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(
    page.getByRole("button", { name: "Rent", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add an annual bill" }).click();
  await page.getByLabel("Bill name").fill("Insurance");
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("1200");
  await page.getByRole("button", { name: "Save annual bill" }).click();
  await expect(
    page.getByRole("button", { name: "Insurance", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Release to this month" }).click();
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("300");
  await page.getByRole("button", { name: "Save activity" }).click();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("weektomonth.budget.v1")!),
  );
  expect(after.entries[0].amount).toBe(30000);
  expect(after.entries[0].kind).toBe("transfer");
  expect(after.entries[0].bucket).toBe("reserve");
  await expect(page.locator(".stat").last()).toContainText("$10,000");
  await expect(page.locator(".cash-pots")).toContainText("$1,700");
  await page.getByRole("button", { name: "Add activity", exact: true }).click();
  await page.getByLabel("Description").fill("Rent payment");
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("1500");
  await page.getByLabel("Budget category").selectOption({ label: "Rent" });
  await page.getByRole("button", { name: "Save activity" }).click();
  await expect(page.locator(".stat").last()).toContainText("$8,500");
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rent", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".spent").first()).toHaveText("$0");
  await page.getByRole("button", { name: "Rent", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("1600");
  await page.getByRole("button", { name: "Save expense" }).click();
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(page.locator(".budget-total")).toContainText("$1,500");
  await page.reload();
  await expect(page.locator(".stat").last()).toContainText("$8,500");
  await expect(
    page.getByRole("button", { name: "Rent", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(page.getByText("Rent payment", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Monthly reserve top-up", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("desktop and phone layout, pinned annual shortcut, accessible modal escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1120 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clearer month starts here." }),
  ).toBeVisible();
  expect(
    await page
      .locator(".annual-column")
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("sticky");
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("link", { name: /Annual bills/ })).toBeVisible();
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Add activity", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("invalid backup and cross-tab changes do not overwrite existing data", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByLabel("Expense name").fill("A valid saved item");
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("10");
  await page.getByRole("button", { name: "Save expense" }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("weektomonth.budget.v1"),
  );
  await page.getByRole("button", { name: "Backup and data" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1,"opening":{"cash":-1}}'),
    });
  await expect(page.getByRole("alert")).toContainText("not a valid");
  expect(
    await page.evaluate(() => localStorage.getItem("weektomonth.budget.v1")),
  ).toBe(before);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const second = await context.newPage();
  await second.goto("/");
  await second.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("weektomonth.budget.v1")!);
    value.household = "Another tab";
    localStorage.setItem("weektomonth.budget.v1", JSON.stringify(value));
  });
  await expect(page.locator(".alert")).toContainText("changed in another tab");
});

test("unreadable storage is protected until an explicit recovery action", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("weektomonth.budget.v1", "{broken"),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("not been overwritten");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByLabel("Expense name").fill("Will not save");
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("100");
  await page.getByRole("button", { name: "Save expense" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("weektomonth.budget.v1")),
  ).toBe("{broken");
});

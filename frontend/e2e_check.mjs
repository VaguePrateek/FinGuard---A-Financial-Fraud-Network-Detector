import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("screenshots", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("response", (res) => {
  if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`);
});

const results = {};

// ---------------- Dashboard ----------------
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
results.dashboardHeading = (await page.locator("h2").first().textContent())?.trim();
results.kpiCards = await page.locator("main .card").count();
results.charts = await page.locator("main svg.recharts-surface").count();
await page.screenshot({ path: "screenshots/01-dashboard.png", fullPage: true });

// ---------------- Transactions ----------------
await page.getByRole("link", { name: "Transactions" }).click();
await page.waitForTimeout(1500);
results.transactionRows = await page.locator("tbody tr").count();
results.transactionHeading = (await page.locator("h2").first().textContent())?.trim();
await page.screenshot({ path: "screenshots/02-transactions.png", fullPage: true });

// Open a transaction detail
await page.locator("tbody tr").first().click();
await page.waitForTimeout(500);
results.transactionModal = await page.getByText("Transaction detail").count();
await page.screenshot({ path: "screenshots/03-transaction-detail.png" });
await page.keyboard.press("Escape");
await page.locator("body").click({ position: { x: 5, y: 500 } });
await page.waitForTimeout(300);

// ---------------- Anomalies ----------------
await page.getByRole("link", { name: "Anomalies" }).click();
await page.waitForTimeout(1800);
results.anomalyHeading = (await page.locator("h2").first().textContent())?.trim();
results.anomalyCards = await page.locator("main .card").count();
results.anomalyCharts = await page.locator("main svg.recharts-surface").count();
await page.screenshot({ path: "screenshots/03b-anomalies.png", fullPage: true });

// ---------------- Cycles ----------------
await page.getByRole("link", { name: "Circular flows" }).click();
await page.waitForTimeout(1500);
results.cycleCards = await page.locator("article").count();
results.cycleHeading = (await page.locator("h2").first().textContent())?.trim();
await page.screenshot({ path: "screenshots/04-cycles.png", fullPage: true });

await page.getByRole("button", { name: /Inspect ring/ }).first().click();
await page.waitForTimeout(1000);
results.cycleDrawer = await page.getByText("Transfers in ring").count();
await page.screenshot({ path: "screenshots/05-cycle-detail.png" });
await page.locator("aside button").first().click();
await page.waitForTimeout(300);

// ---------------- Network ----------------
await page.getByRole("link", { name: "Network" }).click();
await page.waitForTimeout(3000);
results.networkCanvas = await page.locator("canvas").count();
results.networkHeading = (await page.locator("h2").first().textContent())?.trim();
await page.screenshot({ path: "screenshots/06-network.png", fullPage: true });

// ---------------- Generate modal ----------------
await page.getByRole("button", { name: /Generate data/ }).click();
await page.waitForTimeout(500);
results.generateModal = await page.getByText("Generate demo data").count();
await page.screenshot({ path: "screenshots/07-generate-modal.png" });
await page.getByRole("button", { name: "Cancel" }).click();

// ---------------- Run scan ----------------
await page.getByRole("button", { name: /Run scan/ }).click();
const scanToast = page.getByText(/Scan complete/);
await scanToast.waitFor({ state: "visible", timeout: 20000 });
results.scanToast = await scanToast.count();
await page.screenshot({ path: "screenshots/08-scan-toast.png" });

await browser.close();

console.log(JSON.stringify(results, null, 2));
console.log("\nConsole/page errors:", errors.length ? errors : "none");

const failures = [];
if (!results.dashboardHeading?.includes("transactions under surveillance")) failures.push("dashboard heading");
if (results.charts < 3) failures.push("dashboard charts");
if (results.transactionRows < 1) failures.push("transaction rows");
if (results.transactionModal < 1) failures.push("transaction modal");
if (!results.anomalyHeading) failures.push("anomalies heading");
if (results.anomalyCharts < 2) failures.push("anomaly charts");
if (results.cycleCards < 1) failures.push("cycle cards");
if (results.cycleDrawer < 1) failures.push("cycle drawer");
if (results.networkCanvas < 1) failures.push("network canvas");
if (results.generateModal < 1) failures.push("generate modal");
if (results.scanToast < 1) failures.push("scan toast");
if (errors.length) failures.push("console errors");

if (failures.length) {
  console.error("\nFAILED:", failures.join(", "));
  process.exit(1);
}
console.log("\nALL UI CHECKS PASSED");

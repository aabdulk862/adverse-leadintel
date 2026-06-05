import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

const SOURCE_NAME = "google-maps-charlotte";
const DELAY_MS = 3000;

/**
 * Scrapes Google Maps for businesses in a given category/metro.
 * Uses stealth plugin to avoid detection.
 * @param {{ query?: string, vertical?: string, metro?: string, maxScrolls?: number }} options
 * @returns {Promise<{ data: object[], error: object|null }>}
 */
export async function run({
  query = "restaurants in Charlotte NC",
  vertical = "restaurant",
  metro = "charlotte, nc",
  maxScrolls = 5,
} = {}) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "en-US",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(DELAY_MS);

    // Scroll the results panel to load more
    const feed = page.locator('[role="feed"]');
    for (let i = 0; i < maxScrolls; i++) {
      await feed.evaluate((el) => el.scrollBy(0, 2000));
      await page.waitForTimeout(2000 + Math.random() * 1000);
    }

    // Extract listing data
    const records = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="feed"] > div > div > a');
      return [...items].map((a) => {
        const container = a.closest('[role="feed"] > div');
        const name = a.getAttribute("aria-label") || "";
        const href = a.getAttribute("href") || "";
        // Try to get details from the sibling text content
        const text = container?.innerText || "";
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        // Phone is usually a line matching phone pattern
        const phoneLine = lines.find((l) => /^\+?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(l));
        // Address is usually a line with a number at the start
        const addressLine = lines.find((l) => /^\d+\s/.test(l) && l.includes(","));
        // Website sometimes appears
        const websiteLine = lines.find((l) => /\.(com|net|org|io)$/i.test(l));

        return {
          business_name: name,
          phone: phoneLine || null,
          address: addressLine || null,
          website: websiteLine || null,
          source_url: href || null,
        };
      }).filter((r) => r.business_name);
    });

    await browser.close();

    const output = records.map((r) => ({
      ...r,
      owner_name: null,
      email: null,
      license_number: null,
      license_status: null,
      specialties: [],
      source_name: SOURCE_NAME,
      vertical,
      metro,
    }));

    return { data: output, error: null };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { data: null, error: { message: err.message, code: "SCRAPER_ERROR" } };
  }
}

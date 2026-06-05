import { chromium } from "playwright";

const SOURCE_NAME = "yelp-charlotte-restaurants";
const VERTICAL = "restaurant";
const METRO = "charlotte, nc";
const BASE_URL = "https://www.yelp.com/search?find_desc=Restaurants&find_loc=Charlotte%2C+NC";
const DELAY_MS = 2500;

/**
 * Scrapes restaurant listings from Yelp Charlotte.
 * Respects rate limiting (2.5s between page navigations).
 * @param {{ maxPages?: number }} options
 * @returns {Promise<{ data: object[], error: object|null }>}
 */
export async function run({ maxPages = 3 } = {}) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const records = [];

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      const url = pageNum === 0 ? BASE_URL : `${BASE_URL}&start=${pageNum * 10}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(DELAY_MS);

      const items = await page.$$eval(
        '[data-testid="serp-ia-card"]',
        (cards) =>
          cards.map((card) => {
            const nameEl = card.querySelector("a[href*='/biz/'] h3, a[href*='/biz/'] span");
            const linkEl = card.querySelector("a[href*='/biz/']");
            const phoneEl = card.querySelector("p[class*='phone'], span[class*='phone']");
            const addrEl = card.querySelector("address, span[class*='address'], p:last-of-type");
            return {
              business_name: nameEl?.textContent?.replace(/^\d+\.\s*/, "").trim() || "",
              website: null,
              phone: phoneEl?.textContent?.trim() || null,
              address: addrEl?.textContent?.trim() || null,
              source_url: linkEl ? `https://www.yelp.com${linkEl.getAttribute("href")}` : null,
            };
          })
      );

      for (const item of items) {
        if (item.business_name) {
          records.push({
            ...item,
            owner_name: null,
            email: null,
            license_number: null,
            license_status: null,
            specialties: [],
            source_name: SOURCE_NAME,
            vertical: VERTICAL,
            metro: METRO,
          });
        }
      }
    }

    await browser.close();
    return { data: records, error: null };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { data: null, error: { message: err.message, code: "SCRAPER_ERROR" } };
  }
}

/**
 * CLI runner for lead intelligence pipeline.
 * Usage: node src/run.js <command>
 *
 * Commands:
 *   discover  - Run source connectors
 *   qualify   - Score all 'discovered' opportunities
 *   demo      - Generate demos for 'qualified' opportunities
 *   pipeline  - Run full pipeline (discover → qualify → demo → queue)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const command = process.argv[2];

const COMMANDS = {
  async discover() {
    const { runDiscovery } = await import("./sources/index.js");
    const result = await runDiscovery();
    console.log("Discovery complete:", result.data ?? result.error);
  },

  async scrape() {
    const { normalize, dedup } = await import("./lib/normalize.js");
    const { upsertOpportunities } = await import("./lib/store.js");
    const { run } = await import("./sources/googleMaps.js");

    const query = process.argv[3] || "restaurants in Charlotte NC";
    console.log(`[scrape] Google Maps: "${query}"...`);
    const result = await run({ query });
    if (result.error) {
      console.log("Scrape failed:", result.error);
      return;
    }
    const normalized = result.data.map((r) => normalize(r)).filter((r) => r.data).map((r) => r.data);
    const unique = dedup(normalized);
    const stored = await upsertOpportunities(unique);
    console.log(`Scraped: ${unique.length} businesses found, stored:`, stored.data ?? stored.error);
  },

  async qualify() {
    const { runQualification } = await import("./qualify/index.js");
    const result = await runQualification();
    console.log("Qualification complete:", result.data ?? result.error);
  },

  async demo() {
    const { runDemoGeneration } = await import("./demoGen/index.js");
    const result = await runDemoGeneration();
    console.log("Demo generation complete:", result.data ?? result.error);
  },

  async pipeline() {
    console.log("Running full pipeline...\n");
    await COMMANDS.scrape();
    await COMMANDS.discover();
    await COMMANDS.qualify();
    await COMMANDS.demo();
    console.log("\nPipeline complete.");
  },
};

if (!command || !COMMANDS[command]) {
  console.error(`Usage: node src/run.js <${Object.keys(COMMANDS).join("|")}>`);
  process.exit(1);
}

COMMANDS[command]().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

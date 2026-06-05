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

import "dotenv/config";

const command = process.argv[2];

const COMMANDS = {
  async discover() {
    const { runDiscovery } = await import("./sources/index.js");
    const result = await runDiscovery();
    console.log("Discovery complete:", result.data ?? result.error);
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

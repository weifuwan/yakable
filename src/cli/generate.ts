import 'dotenv/config';

import { createDefaultAgentRuntime } from '../agent-runtime/agent-runtime.js';
import { BuildIntentGateError } from '../prompt-intelligence/build-intent.js';

function usage(): never {
  console.error('Usage: npm run generate -- "Build a simple SaaS landing page"');
  process.exit(1);
}

const prompt = process.argv.slice(2).join(' ').trim();
if (!prompt) {
  usage();
}

const agentRuntime = createDefaultAgentRuntime();

try {
  console.log('Yakable: Generate project');
  console.log('Checking build intent, then generating source; no build or preview will run.');

  const result = await agentRuntime.createProject(prompt);

  console.log(`Build Intent: ${result.buildIntent.route} · ${result.buildIntent.confidence}`);
  console.log(
    `Intent: ${result.intent.productType} · ${result.intent.pageType} · ${result.intent.primaryGoal}`,
  );
  console.log(
    `Semantic defaults: ${result.semanticExpansion.defaults.length} · Deferred decisions: ${result.semanticExpansion.deferredDecisions.length}`,
  );
  console.log(`Taste: ${result.tasteTranslation.designDirection}`);
  console.log(
    `Design IR v${result.designIntent.version}: ${result.designIntent.requirements.length} requirements · ${result.designIntent.directives.length} directives · ${result.designIntent.openQuestions.length} open questions`,
  );
  console.log(`Model: ${result.model}`);
  console.log(`Files: ${result.project.files.length}`);
  console.log(`Output: ${result.outputDirectory}`);
  console.log(`Summary: ${result.project.summary}`);
} catch (error) {
  if (error instanceof BuildIntentGateError) {
    console.log(`Build Intent: ${error.decision.route} · ${error.decision.confidence}`);
    console.log(error.decision.message);
  } else {
    console.error(`\nGeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exitCode = 1;
  }
}

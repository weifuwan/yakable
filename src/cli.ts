import 'dotenv/config';

import { generateProject } from './generate.js';

function usage(): never {
  console.error('Usage: npm run generate -- "Build a simple SaaS landing page"');
  process.exit(1);
}

const prompt = process.argv.slice(2).join(' ').trim();
if (!prompt) {
  usage();
}

try {
  console.log('Yakable Stage 1: Prompt -> Code');
  console.log('Generating source only; no build or preview will run.');

  const result = await generateProject(prompt);

  console.log(
    `Intent: ${result.intent.productType} · ${result.intent.pageType} · ${result.intent.primaryGoal}`,
  );
  console.log(`Model: ${result.model}`);
  console.log(`Files: ${result.project.files.length}`);
  console.log(`Output: ${result.outputDirectory}`);
  console.log(`Summary: ${result.project.summary}`);
} catch (error) {
  console.error(`\nGeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}

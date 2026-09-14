import 'dotenv/config';

import { createBaseProject } from '../templates/base-template.js';

const [projectId] = process.argv.slice(2);

if (!projectId) {
  console.error('Usage: npm run create:base -- <project-id>');
  process.exitCode = 1;
} else {
  createBaseProject(projectId)
    .then((result) => {
      console.log(`Yakable Base created: ${result.directory}`);
      console.log(`Run it with: npm run run:project -- generated/${result.id}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

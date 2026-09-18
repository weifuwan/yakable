import 'dotenv/config';

import { installCapabilityPacks } from '../templates/capability-pack.js';

const [projectInput, ...packIds] = process.argv.slice(2);

if (!projectInput || packIds.length === 0) {
  console.error('Usage: npm run add:pack -- <project-id-or-path> <pack-id> [pack-id...]');
  process.exitCode = 1;
} else {
  installCapabilityPacks(projectInput, packIds)
    .then((result) => {
      if (result.installedPacks.length) {
        console.log(`Installed capability packs: ${result.installedPacks.join(', ')}`);
      }
      if (result.alreadyInstalledPacks.length) {
        console.log(`Already installed: ${result.alreadyInstalledPacks.join(', ')}`);
      }
      if (result.addedFiles.length) {
        console.log(`Added ${result.addedFiles.length} files.`);
      }
      if (result.addedDependencies.length) {
        console.log(
          `Added dependencies: ${result.addedDependencies
            .map((dependency) => `${dependency.name}@${dependency.version}`)
            .join(', ')}`,
        );
        console.log(`Run npm install inside ${result.projectDirectory} before using the new dependencies.`);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

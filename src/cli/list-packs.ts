import 'dotenv/config';

import { listCapabilityPacks } from '../templates/capability-pack.js';

listCapabilityPacks()
  .then((packs) => {
    if (!packs.length) {
      console.log('No capability packs are available.');
      return;
    }

    for (const pack of packs) {
      const dependencies = Object.keys(pack.dependencies).length;
      console.log(`${pack.id}\t${dependencies} deps\t${pack.description}`);
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });

import { config } from "./config.js";
import { createServer } from "./server.js";

const server = createServer(config);

await server.start();

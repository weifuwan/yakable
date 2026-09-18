import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../../..");
const yakableDataRoot = path.join(repositoryRoot, ".yakable");

loadEnv({
  path: path.join(repositoryRoot, ".env"),
});

export type ServerConfig = {
  host: string;
  port: number;
  project: {
    projectsRoot: string;
    workspacesRoot: string;
    templatePath: string;
  };
  agent: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
};

export const config: ServerConfig = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8787),
  project: {
    projectsRoot: path.join(yakableDataRoot, "projects"),
    workspacesRoot: path.join(yakableDataRoot, "workspaces"),
    templatePath: path.join(repositoryRoot, "templates/react-vite"),
  },
  agent: {
    baseUrl: process.env.AI_BASE_URL?.trim() ?? "",
    apiKey: process.env.AI_API_KEY?.trim() ?? "",
    model: process.env.AI_MODEL?.trim() ?? "",
  },
};

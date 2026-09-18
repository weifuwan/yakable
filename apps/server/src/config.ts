import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../../..");
const yakableDataRoot = path.join(repositoryRoot, ".yakable");

export type ServerConfig = {
  host: string;
  port: number;
  project: {
    projectsRoot: string;
    workspacesRoot: string;
    templatePath: string;
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
};

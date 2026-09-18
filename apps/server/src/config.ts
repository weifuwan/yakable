import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../../..");

export type ServerConfig = {
  host: string;
  port: number;
  workspace: {
    id: string;
    rootPath: string;
    templatePath: string;
  };
};

export const config: ServerConfig = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8787),
  workspace: {
    id: "default",
    rootPath: path.join(repositoryRoot, ".yakable/workspaces/default"),
    templatePath: path.join(repositoryRoot, "templates/react-vite"),
  },
};

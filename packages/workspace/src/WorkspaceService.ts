import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export type WorkspaceEntry = {
  name: string;
  path: string;
  type: "file" | "folder";
  depth: number;
};

export class WorkspacePathError extends Error {}

const IGNORED_NAMES = new Set(["node_modules", "dist", ".git"]);

export class WorkspaceService {
  constructor(
    readonly rootPath: string,
    private readonly starterPath: string,
  ) {}

  async ensure(): Promise<void> {
    try {
      await lstat(this.rootPath);
    } catch {
      await mkdir(path.dirname(this.rootPath), { recursive: true });
      await cp(this.starterPath, this.rootPath, { recursive: true });
    }
  }

  async reset(): Promise<void> {
    await rm(this.rootPath, { recursive: true, force: true });
    await mkdir(path.dirname(this.rootPath), { recursive: true });
    await cp(this.starterPath, this.rootPath, { recursive: true });
  }

  async listFiles(): Promise<WorkspaceEntry[]> {
    await this.ensure();
    return this.walk(this.rootPath, "");
  }

  async isPristine(): Promise<boolean> {
    await this.ensure();

    const [workspaceEntries, starterEntries] = await Promise.all([
      this.walk(this.rootPath, ""),
      this.walk(this.starterPath, ""),
    ]);

    if (workspaceEntries.length !== starterEntries.length) {
      return false;
    }

    for (let index = 0; index < workspaceEntries.length; index += 1) {
      const workspaceEntry = workspaceEntries[index];
      const starterEntry = starterEntries[index];

      if (
        workspaceEntry.path !== starterEntry.path ||
        workspaceEntry.type !== starterEntry.type
      ) {
        return false;
      }

      if (workspaceEntry.type !== "file") {
        continue;
      }

      const [workspaceContent, starterContent] = await Promise.all([
        readFile(path.join(this.rootPath, workspaceEntry.path), "utf8"),
        readFile(path.join(this.starterPath, starterEntry.path), "utf8"),
      ]);

      if (workspaceContent !== starterContent) {
        return false;
      }
    }

    return true;
  }

  async readFile(relativePath: string): Promise<string> {
    const target = this.resolvePath(relativePath);
    await this.assertNoSymlinks(target);
    return readFile(target, "utf8");
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const target = this.resolvePath(relativePath);
    await this.assertNoSymlinks(path.dirname(target));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  async deleteFile(relativePath: string): Promise<void> {
    if (!relativePath.trim()) {
      throw new WorkspacePathError("Workspace root cannot be deleted.");
    }

    const target = this.resolvePath(relativePath);
    await this.assertNoSymlinks(target);
    await rm(target, { recursive: true, force: true });
  }

  private resolvePath(relativePath: string): string {
    if (!relativePath || path.isAbsolute(relativePath)) {
      throw new WorkspacePathError("Workspace path must be relative.");
    }

    const normalized = relativePath.replaceAll("\\", "/");
    const target = path.resolve(this.rootPath, normalized);
    const rootWithSeparator = this.rootPath.endsWith(path.sep)
      ? this.rootPath
      : `${this.rootPath}${path.sep}`;

    if (target !== this.rootPath && !target.startsWith(rootWithSeparator)) {
      throw new WorkspacePathError("Path escapes the workspace root.");
    }

    return target;
  }

  private async assertNoSymlinks(target: string): Promise<void> {
    const relative = path.relative(this.rootPath, target);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new WorkspacePathError("Path escapes the workspace root.");
    }

    let current = this.rootPath;
    const parts = relative.split(path.sep).filter(Boolean);

    for (const part of parts) {
      current = path.join(current, part);

      try {
        const info = await lstat(current);
        if (info.isSymbolicLink()) {
          throw new WorkspacePathError("Symbolic links are not allowed in a workspace path.");
        }
      } catch (error) {
        if (
          error instanceof WorkspacePathError ||
          (error instanceof Error && "code" in error && error.code !== "ENOENT")
        ) {
          throw error;
        }

        return;
      }
    }
  }

  private async walk(
    absoluteDirectory: string,
    relativeDirectory: string,
  ): Promise<WorkspaceEntry[]> {
    const directoryEntries = await readdir(absoluteDirectory, {
      withFileTypes: true,
    });

    directoryEntries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    const result: WorkspaceEntry[] = [];

    for (const entry of directoryEntries) {
      if (IGNORED_NAMES.has(entry.name) || entry.isSymbolicLink()) {
        continue;
      }

      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const depth = relativePath.split("/").length - 1;

      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: relativePath,
          type: "folder",
          depth,
        });

        result.push(
          ...(await this.walk(
            path.join(absoluteDirectory, entry.name),
            relativePath,
          )),
        );
        continue;
      }

      if (entry.isFile()) {
        result.push({
          name: entry.name,
          path: relativePath,
          type: "file",
          depth,
        });
      }
    }

    return result;
  }
}

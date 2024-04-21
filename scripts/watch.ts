import { error, log, warn } from "console";
import { build } from "esbuild";
import { existsSync } from "fs";
import { watch } from "fs/promises";
import { packageDirectory } from "package-directory";
import { join, relative } from "path";
import { exit } from "process";
import { esbuildOptions } from "./options.ts";

const PACKAGE_DIR = (await packageDirectory()) ?? "";

if (!PACKAGE_DIR) {
  error("Could not find package directory");
  exit(1);
}

const SRC_DIR = join(PACKAGE_DIR, "src");

const pending = new Set<string>();
let processing = false;

function isTypeScriptSource(filePath: string): boolean {
  return filePath.endsWith(".ts") && !filePath.endsWith(".d.ts");
}

async function buildFile(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    warn(`Skipping missing file: ${relative(PACKAGE_DIR, filePath)}`);
    return;
  }

  log(`Building ${relative(PACKAGE_DIR, filePath)}`);

  await build({ ...esbuildOptions, entryPoints: [filePath] });
}

async function flushQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (pending.size) {
    const [filePath] = pending;
    if (!filePath) break;
    pending.delete(filePath);

    try {
      await buildFile(filePath);
    } catch (err) {
      error(`Build failed for ${relative(PACKAGE_DIR, filePath)}`);
      error(err);
    }
  }

  processing = false;
}

async function handleChange(filePath: string): Promise<void> {
  if (!isTypeScriptSource(filePath)) return;
  pending.add(filePath);
  await flushQueue();
}

async function startWatch(): Promise<void> {
  log(`Watching ${SRC_DIR} for TypeScript changes...`);
  let watcher;

  try {
    watcher = watch(SRC_DIR, { recursive: true });
  } catch (err) {
    error("Failed to start watcher");
    error(err);
    exit(1);
  }

  for await (const { filename } of watcher) {
    if (!filename) continue;
    await handleChange(join(SRC_DIR, filename));
  }
}

await startWatch();

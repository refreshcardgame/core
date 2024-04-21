#!/usr/bin/env node
import { error, log } from "console";
import { readdir, stat, writeFile } from "fs/promises";
import { packageDirectory } from "package-directory";
import { dirname, join, relative, sep } from "path";
import { exit } from "process";

const PACKAGE_DIR = await packageDirectory();

if (!PACKAGE_DIR) {
  error("Could not find package directory");
  exit(1);
}

const SRC_DIR = join(PACKAGE_DIR, "src");

/**
 * Get all TypeScript files in a directory recursively
 * @param dir - Directory to scan
 * @param baseDir - Base directory for relative path calculation
 * @returns Array of relative file paths
 */
async function getTypeScriptFiles(
  dir: string,
  baseDir = dir,
): Promise<string[]> {
  const files = [];
  const items = await readdir(dir);

  for (const item of items) {
    const fullPath = join(dir, item);

    if ((await stat(fullPath)).isDirectory())
      // Recursively get files from subdirectories
      files.push(...(await getTypeScriptFiles(fullPath, baseDir)));
    else if (item.endsWith(".ts") && item !== "index.ts") {
      // Get relative path from src directory
      const relativePath = relative(baseDir, fullPath);
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Convert file path to export statement
 * @param filePath - Relative file path
 * @returns Export statement
 */
function toExportStatement(filePath: string): string {
  // Convert Windows backslashes to forward slashes
  const normalizedPath = filePath.split(sep).join("/");
  return normalizedPath.endsWith(".d.ts")
    ? `export type * from "./${normalizedPath}";`
    : `export * from "./${normalizedPath}";`;
}

/**
 * Group files by directory
 * @param files - Array of file paths
 * @returns Map of directory to files
 */
function groupByDirectory(files: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const file of files) {
    let dir = dirname(file);
    if (dir === ".") dir = "";
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)?.push(file);
  }

  return groups;
}

/**
 * Generate the index.ts file
 */
async function generateIndex(): Promise<void> {
  log("Scanning src directory...");
  const files = await getTypeScriptFiles(SRC_DIR);

  if (files.length === 0) {
    log("No TypeScript files found!");
    return;
  }

  log(`Found ${files.length.toString()} TypeScript files`);

  // Group files by directory
  const groups = groupByDirectory(files);

  // Sort groups: root files first, then subdirectories alphabetically
  const sortedGroups = groups
    .entries()
    .toArray()
    .sort(([a], [b]) => {
      if (a === "" && b !== "") return -1;
      if (a !== "" && b === "") return 1;
      return a.localeCompare(b);
    });

  // Generate export statements
  const lines = [];

  for (const [dir, dirFiles] of sortedGroups) {
    if (dir !== "") {
      lines.push(`// Export ${dir} submodules`);
    }

    // Sort files within each directory
    const sortedFiles = dirFiles.sort();

    for (const file of sortedFiles) {
      lines.push(toExportStatement(file));
    }

    // Add blank line between groups (except after last group)
    if (dir !== sortedGroups.at(-1)?.[0]) {
      lines.push("");
    }
  }

  const content = lines.join("\n") + "\n";

  log("Writing index.ts...");
  await writeFile(join(SRC_DIR, "index.ts"), content, "utf-8");

  log("✓ Successfully generated index.ts");
  log(`  Total exports: ${files.length.toString()}`);
}

// Run the script
try {
  await generateIndex();
} catch (err) {
  error("Error generating index.ts:", err);
  exit(1);
}

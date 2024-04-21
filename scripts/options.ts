import { rewriteRelativeImportExtensionsPlugin } from "@onyx/esbuild-plugin-rewrite-relative-import-extensions";
import { error } from "console";
import type { BuildOptions } from "esbuild";
import { packageDirectory } from "package-directory";
import { join } from "path";
import { exit } from "process";

const PACKAGE_DIR = await packageDirectory();

if (!PACKAGE_DIR) {
  error("Could not find package directory");
  exit(1);
}

export const esbuildOptions: BuildOptions = {
  bundle: false,
  format: "esm",
  logLevel: "info",
  outdir: join(PACKAGE_DIR, "dist"),
  plugins: [rewriteRelativeImportExtensionsPlugin()],
  sourcemap: true,
  target: "esnext",
  tsconfig: join(PACKAGE_DIR, "tsconfig.json"),
};

import { error } from "console";
import { rm } from "fs/promises";
import { packageDirectory } from "package-directory";
import { join } from "path";
import { exit } from "process";

const PACKAGE_DIR = await packageDirectory();

if (!PACKAGE_DIR) {
  error("Could not find package directory");
  exit(1);
}

await rm(join(PACKAGE_DIR, "dist"), { force: true, recursive: true });

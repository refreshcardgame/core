import { error, log } from "console";
import { ESLint } from "eslint";
import { packageDirectory } from "package-directory";
import { join } from "path";
import { exit } from "process";

const PACKAGE_DIR = await packageDirectory();

if (!PACKAGE_DIR) {
  error("Could not find package directory");
  exit(1);
}

const eslint = new ESLint({
  flags: ["unstable_native_nodejs_ts_config"],
  overrideConfigFile: join(PACKAGE_DIR, "eslint.config.ts"),
});
const results = await eslint.lintFiles([join(PACKAGE_DIR, "src")]);
const formatter = await eslint.loadFormatter("stylish");
const resultText = formatter.format(results);

if (resultText) {
  log(resultText);
  exit(1);
}

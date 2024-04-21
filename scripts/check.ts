import { execSync } from "child_process";
import { exit } from "process";

try {
  execSync("npx tsc", { stdio: "inherit" });
} catch {
  exit(1);
}

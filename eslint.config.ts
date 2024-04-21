import js from "@eslint/js";
import eslintConfigPrettierFlat from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import _default from "typescript-eslint";

export default defineConfig(
  js.configs.recommended,
  _default.configs.strictTypeChecked,
  _default.configs.stylisticTypeChecked,
  { languageOptions: { parserOptions: { projectService: true } } },
  eslintConfigPrettierFlat,
  globalIgnores(["**/node_modules/**", "**/*.js"]),
);

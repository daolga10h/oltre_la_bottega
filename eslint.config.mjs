import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vecchi worktree Git sotto .claude/ (creati dallo strumento worktree
    // di superpowers durante lo sviluppo a task): contengono una copia
    // duplicata di src/ e non vanno lintati.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;

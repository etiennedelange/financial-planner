import path from "path"
import { defineConfig } from "vite-plus"

export default defineConfig({
  // Next.js owns dev and build; Vite+ runs the tests, lint and format.
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: [],
    exclude: [
      "**/node_modules/**",
      "dist",
      ".idea",
      ".git",
      ".cache",
      ".worktrees/**",
      "e2e/**",
      "**/*.spec.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "out/",
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "**/types/**",
        "**/__tests__/**",
        "**/verify-*.ts",
        "docs/history/**",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  // Double quotes and no semicolons: the style most of lib/ and components/ already use.
  fmt: {
    semi: false,
    printWidth: 100,
    // Tool-owned (vendored agent skills, Claude Code config, design-tool state) or
    // generated; Markdown is left as written.
    ignorePatterns: [
      ".agents/**",
      ".claude/**",
      ".impeccable/**",
      "types/supabase.ts",
      // Email templates: hand-laid-out HTML that GoTrue sends as written.
      "supabase/templates/**",
      "pnpm-lock.yaml",
      "*.md",
    ],
  },
  lint: {
    plugins: ["oxc", "typescript", "unicorn", "nextjs"],
    categories: {
      correctness: "warn",
    },
    env: {
      builtin: true,
    },
    ignorePatterns: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Tool-owned: vendored agent skills, Claude Code config, design-tool state.
      ".agents/**",
      ".claude/**",
      ".impeccable/**",
    ],
    rules: {
      "nextjs/no-html-link-for-pages": "error",
      "nextjs/no-sync-scripts": "error",
      "nextjs/inline-script-id": "error",
      "nextjs/no-assign-module-variable": "error",
      "nextjs/no-document-import-in-page": "error",
      "nextjs/no-duplicate-head": "error",
      "nextjs/no-head-import-in-document": "error",
      "nextjs/no-script-component-in-head": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
      // Money-time discipline: see lint/money-time-plugin.mjs.
      "money-time/no-hand-rolled-inflation": "error",
    },
    overrides: [
      {
        files: [
          "lib/calculations/utils/money-time.ts",
          "lib/calculations/utils/money-time.test.ts",
          // Tests are DELIBERATELY exempt. A test that verifies the engine's escalation
          // must compute its expected value independently; if it called the same
          // escalate() the engine calls, a bug inside escalate() would be invisible and
          // the test would merely restate the implementation. Hand-rolled arithmetic in
          // a test is an independent oracle, not a smell.
          "**/*.test.ts",
          "**/*.test.tsx",
          "**/__tests__/**",
        ],
        rules: {
          "money-time/no-hand-rolled-inflation": "off",
        },
      },
      {
        files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
        rules: {
          "react/display-name": "error",
          "react/jsx-key": "error",
          "react/jsx-no-comment-textnodes": "error",
          "react/jsx-no-duplicate-props": "error",
          "react/jsx-no-target-blank": "off",
          "react/jsx-no-undef": "error",
          "react/no-children-prop": "error",
          "react/no-danger-with-children": "error",
          "react/no-direct-mutation-state": "error",
          "react/no-find-dom-node": "error",
          "react/no-is-mounted": "error",
          "react/no-render-return-value": "error",
          "react/no-string-refs": "error",
          "react/no-unescaped-entities": "error",
          "react/no-unknown-property": "off",
          "react/no-unsafe": "off",
          "react/react-in-jsx-scope": "off",
          "react/require-render-return": "error",
          "import/no-anonymous-default-export": "warn",
          "jsx-a11y/alt-text": [
            "warn",
            {
              elements: ["img"],
              img: ["Image"],
            },
          ],
          "jsx-a11y/aria-props": "warn",
          "jsx-a11y/aria-proptypes": "warn",
          "jsx-a11y/aria-unsupported-elements": "warn",
          "jsx-a11y/role-has-required-aria-props": "warn",
          "jsx-a11y/role-supports-aria-props": "warn",
          // Wants <output>/<figure>/<progress> for role="status"/"figure"/"progressbar" on
          // styled divs (chart wrappers, notices, custom bars); the roles are deliberate.
          "jsx-a11y/prefer-tag-over-role": "off",
          "nextjs/google-font-display": "warn",
          "nextjs/google-font-preconnect": "warn",
          "nextjs/next-script-for-ga": "warn",
          "nextjs/no-async-client-component": "warn",
          "nextjs/no-before-interactive-script-outside-document": "warn",
          "nextjs/no-css-tags": "warn",
          "nextjs/no-head-element": "warn",
          "nextjs/no-html-link-for-pages": "warn",
          "nextjs/no-img-element": "warn",
          "nextjs/no-page-custom-font": "warn",
          "nextjs/no-styled-jsx-in-document": "warn",
          "nextjs/no-sync-scripts": "warn",
          "nextjs/no-title-in-document-head": "warn",
          "nextjs/no-typos": "warn",
          "nextjs/no-unwanted-polyfillio": "warn",
          "react/rules-of-hooks": "error",
          "react/exhaustive-deps": "warn",
          "react/static-components": "error",
          "react/use-memo": "error",
          "react/preserve-manual-memoization": "error",
          "react/incompatible-library": "warn",
          "react/immutability": "error",
          "react/globals": "error",
          "react/refs": "error",
          "react/set-state-in-effect": "error",
          "react/error-boundaries": "error",
          "react/purity": "error",
          "react/set-state-in-render": "error",
          "react/unsupported-syntax": "warn",
        },
        plugins: ["react", "import", "jsx-a11y"],
        env: {
          browser: true,
          node: true,
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
      "./lint/money-time-plugin.mjs",
    ],
  },
})

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [],
    exclude: [
      '**/node_modules/**',
      'dist',
      '.idea',
      '.git',
      '.cache',
      '.worktrees/**',
      'e2e/**',
      '**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'out/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/types/**',
        '**/__tests__/**',
        '**/verify-*.ts',
        'docs/history/**',
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
      '@': path.resolve(__dirname, './'),
    },
  },
})

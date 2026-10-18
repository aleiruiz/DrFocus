import { defineConfig } from 'vitest/config';

export default defineConfig({
  // apps/mobile extiende expo/tsconfig.base, que el transformador no resuelve; las pruebas usan el tsconfig raíz.
  tsconfig: 'tsconfig.json',
  test: {
    include: ['packages/*/test/**/*.test.ts', 'supabase/functions/**/*.test.ts', 'apps/mobile/src/**/*.test.ts'],
    environment: 'node',
  },
});

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',        // these are pure functions — no DOM needed
    include: ['src/__tests__/**/*.test.js'],
    reporters: 'verbose',
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/utils/**'],
    },
  },
})

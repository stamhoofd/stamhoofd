import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'frontend/app/*',
  'frontend/shared/*',
  'tests/*/vitest.config.ts',
])

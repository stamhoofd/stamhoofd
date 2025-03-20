import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'frontend/app/*',
  'frontend/shared/*',
  '.development/i18n-uuid'
])

import { defineConfig } from 'oxfmt';
import { oxcOnlyIgnores } from './shared/eslint/src/ownership.js';

export default defineConfig({
    ignorePatterns: [
        ...oxcOnlyIgnores,
        'shared/locales/**',
        'frontend/app/mobile/capacitor.config.json',
        'frontend/app/mobile/native-dependencies.json',
        'backend/app/api/src/services/belcotax/schemas/**', // Copied unchanged from FOD Financiën
    ],
    singleQuote: true,
    sortPackageJson: false,
});

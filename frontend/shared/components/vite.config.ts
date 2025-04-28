import { defineConfig } from 'vite';

import { buildConfig } from '../../vite.config.shared';

// https://vitejs.dev/config/
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineConfig({
    ...buildConfig({ port: 0 }),
} as any);

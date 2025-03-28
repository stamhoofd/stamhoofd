import { defineConfig } from 'vite';

import { buildConfig } from '../../vite.config.shared';

// Set timezone!
process.env.TZ = 'UTC';

// https://vitejs.dev/config/
export default defineConfig({
    ...buildConfig({ port: 0 }),
});

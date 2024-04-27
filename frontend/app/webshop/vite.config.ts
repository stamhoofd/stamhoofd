import { defineConfig } from 'vite';

import {buildConfig} from '../../vite.config.shared';

// https://vitejs.dev/config/
export default defineConfig({
    ...buildConfig({port: 8082})
})

import { buildConfig } from '@stamhoofd/vite-config';
import { FrontendApp } from '@stamhoofd/types/FrontendApp';

process.env.TZ = 'UTC';

export default await buildConfig({
    name: FrontendApp.WebApp,
    port: 0,
    frontendDir: new URL('../..', import.meta.url).pathname,
});

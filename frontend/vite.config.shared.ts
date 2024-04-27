import viteSvgToWebfont from '@simonbackx/vite-svg-2-webfont';
import vue from '@vitejs/plugin-vue2';
import fs from 'fs';
import path, { resolve } from 'path';

import iconConfig from './shared/assets/images/icons/icons.font';

const use_env: Record<string, string> = {}

// This is a debug config as a replacement for process.env.NODE_ENV which seems to break webpack 5
// process.env.BUILD_FOR_PRODUCTION

if (process.env.NODE_ENV === "production") {
    console.log("Building for production...")
}

if (process.env.LOAD_ENV) {
    // Load this in the environment
    const decode = JSON.parse(process.env.LOAD_ENV);

    // We restringify to make sure encoding is minified
    use_env["STAMHOOFD"] = JSON.stringify(decode);
    use_env["process.env.NODE_ENV"] = JSON.stringify(decode.environment === "production" ? "production" : "development")
} else if (process.env.ENV_FILE) {
    // Reading environment from a JSON env file (JSON is needed)
    const file = path.resolve(process.env.ENV_FILE)

    // Load this in the environment
    const contents = fs.readFileSync(file)
    const decode = JSON.parse(contents);
    const node_env = JSON.stringify(decode.environment === "production" ? "production" : "development")

    console.log("Using environment file: "+file)

    const stamhoofdEnv = JSON.stringify(decode)

    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env["STAMHOOFD"] = stamhoofdEnv
    
    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env["process.env.NODE_ENV"] = node_env

} else {
    throw new Error("ENV_FILE or LOAD_ENV environment variables are missing")
}

// https://vitejs.dev/config/
export function buildConfig(options: {port: number}) {
    return {
        plugins: [
            vue(),
            viteSvgToWebfont({
                ...iconConfig,
                context: resolve(__dirname, './shared/assets/images/icons/'),
                cssTemplate: resolve(__dirname, './shared/assets/images/icons/iconCss.hbs'),
            }),
        ],
        define: use_env,
        server: {
            host: '0.0.0.0',
            port: options.port,
            strictPort: true,
            hmr: {
                clientPort: 443
            }

        },
        build: {
            sourcemap: 'inline'
        }
    }
}

import type { CliContext } from '../context/create-context.js';
import { buildDevelopmentConfig } from './development-config.js';

export function buildDomains(context: CliContext) {
    return buildDevelopmentConfig(context).domains;
}

export function buildBackendEnv(context: CliContext): NodeJS.ProcessEnv {
    return buildDevelopmentConfig(context).backendEnv;
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function getProjectPath(): string {
    const cliDir = path.dirname(fileURLToPath(import.meta.url));
    return `${path.resolve(cliDir, '../../../..')}/`;
}

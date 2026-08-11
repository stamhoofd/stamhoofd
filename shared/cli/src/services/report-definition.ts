import fs from 'fs/promises';
import path from 'path';
import type { CliContext } from '../context/create-context.js';
import { run } from '../runtime/command-runner.js';
import type { ReportTab } from './metabase-report.js';

/**
 * Where the report definition lives: with the migration that creates the tables its queries read.
 */
export const statisticsPackagePath = path.join('backend', 'app', 'statistics');

/**
 * Reads the report by running the statistics service, which owns the parser as well as the queries.
 *
 * The CLI is built before the backend packages are, so it cannot import that package without
 * inverting the build order. Asking the built package to print its definition keeps a single copy of
 * both the queries and the rules for reading them.
 */
export async function loadReportDefinition(context: CliContext): Promise<ReportTab[]> {
    const script = path.join(context.rootDir, statisticsPackagePath, 'dist', 'src', 'print-report.js');

    if (!await exists(script)) {
        throw new Error(`The statistics service is not built, so the report definition cannot be read. Run: yarn --cwd ${statisticsPackagePath} build`);
    }

    const result = await run('node', [script], { capture: true, quiet: true, verbose: context.verbose });

    try {
        return JSON.parse(result.stdout) as ReportTab[];
    }
    catch (error) {
        throw new Error(`Could not read the report definition printed by ${script}`, { cause: error });
    }
}

async function exists(file: string): Promise<boolean> {
    return await fs.stat(file).then(() => true).catch(() => false);
}

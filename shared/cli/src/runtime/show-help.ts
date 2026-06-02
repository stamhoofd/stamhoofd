import { loadHelpClass } from '@oclif/core';
import type { Interfaces } from '@oclif/core';

export async function showHelp(config: Interfaces.Config, argv: string[]): Promise<void> {
    const HelpClass = await loadHelpClass(config);
    await new HelpClass(config).showHelp(argv);
}

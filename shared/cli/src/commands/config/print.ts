import { BaseCommand } from '../../base-command.js';
import { buildBackendEnv, buildDomains } from '../../config/build-config.js';

export default class ConfigPrint extends BaseCommand {
    static summary = 'Print resolved local configuration';
    static description = 'Use this when you want raw JSON for debugging, scripting, or inspecting domains and environment variables.';
    static examples = [
        'stam config print --env keeo',
        'stam config print --env keeo --name feature-payments',
        'stam config print --verbose',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(ConfigPrint);
        const context = await this.createContext(flags);
        const domains = buildDomains(context);
        this.log(JSON.stringify({ domains, env: buildBackendEnv(context) }, null, 4));
    }
}

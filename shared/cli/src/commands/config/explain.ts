import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { link } from '../../runtime/ux.js';

export default class ConfigExplain extends BaseCommand {
    static summary = 'Explain resolved local configuration';
    static description = 'Use this before running a local instance if you want a readable summary instead of raw JSON.';
    static examples = [
        'stam config explain --env keeo',
        'stam config explain --env keeo --name feature-payments',
        'stam config explain --verbose',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(ConfigExplain);
        const context = await this.createContext(flags);
        const domains = buildDomains(context);
        this.log(`Environment: ${context.env}`);
        this.log(`Instance:    ${context.instance.name}`);
        this.log(`Primary:     ${context.instance.primary ? 'yes' : 'no'}`);
        this.log(`Prefix:      ${context.instance.prefix || '-'}`);
        this.log(`Port offset: ${context.instance.portOffset}`);
        this.log(`Dashboard:   ${link(`https://${domains.dashboard}`, `https://${domains.dashboard}`)}`);
        this.log(`API:         ${link(`https://${domains.api}`, `https://${domains.api}`)}`);
    }
}

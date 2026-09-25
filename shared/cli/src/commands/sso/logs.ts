import { BaseCommand } from '../../base-command.js';
import { ssoService } from '../../services/definitions/sso-service.js';

export default class SsoLogs extends BaseCommand {
    static summary = 'Tail local SSO server logs';
    static description = 'Use this while debugging login failures, redirect problems, or identity provider configuration issues.';
    static examples = [
        'stam sso logs',
        'stam sso logs --env keeo',
    ];
    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(SsoLogs);
        await ssoService.logs?.(context);
    }
}

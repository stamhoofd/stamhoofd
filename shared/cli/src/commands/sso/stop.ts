import { BaseCommand } from '../../base-command.js';
import { ssoService } from '../../services/definitions/sso-service.js';

export default class SsoStop extends BaseCommand {
    static summary = 'Stop the local SSO server';
    static description = 'Use this when you want to restart SSO with a new redirect URL or fully stop local login testing.';
    static examples = [
        'stam sso stop',
        'stam sso stop --env keeo',
    ];
    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(SsoStop);
        await ssoService.stop(context);
        this.log('Local SSO server stopped.');
    }
}

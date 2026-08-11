import { MollieToken } from '@stamhoofd/models';

import { SettlementService } from '../services/SettlementService.js';
import { MollieSettlementSync } from './MollieSettlementSync.js';
import type { ProviderSettlementSyncRunner, ProviderSyncRunOptions } from './ProviderSettlementSyncRunner.js';

/**
 * Walks every Mollie account: the platform's own account first, then all organization tokens.
 * No constructor configuration: Mollie has no platform-wide credential — tokens are per account
 * (STAMHOOFD.MOLLIE_ORGANIZATION_TOKEN for the platform, a MollieToken row per organization).
 */
export class MollieSettlementSyncRunner implements ProviderSettlementSyncRunner {
    async run({ start, end, summary, onProgress }: ProviderSyncRunOptions): Promise<void> {
        const accessToken = STAMHOOFD.MOLLIE_ORGANIZATION_TOKEN;
        if (!accessToken) {
            console.error('Missing mollie organization token');
        } else {
            try {
                // The platform's own Mollie account belongs to the membership organization, but a
                // platform without one must not block the per-organization tokens
                const token = new MollieToken();
                token.organizationId = await SettlementService.getPlatformOrganizationId();
                token.accessToken = accessToken;
                // A plain access token without a refresh flow: the future expiry keeps
                // refreshIfNeeded from attempting one
                token.expiresOn = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
                await new MollieSettlementSync({ token }).syncSettlements({ start, end, summary });
            } catch (e) {
                console.error(e);
                summary.failed += 1;
            }
            onProgress?.();
        }

        const mollieTokens = await MollieToken.all();
        for (const token of mollieTokens) {
            // Tokens created before the settlements permission was added to the OAuth scope
            // cannot read settlements
            if (token.createdAt < new Date(2021, 8 /* september! */, 8)) {
                console.log('Skipped mollie token that is too old');
                continue;
            }

            try {
                await new MollieSettlementSync({ token }).syncSettlements({ start, end, summary });
            } catch (e) {
                console.error(e);
                summary.failed += 1;
            }
            onProgress?.();
        }
    }
}

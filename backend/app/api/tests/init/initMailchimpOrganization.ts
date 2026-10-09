import type { Endpoint } from '@simonbackx/simple-endpoints';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { OrganizationFactory } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { STPackageBundle, Version } from '@stamhoofd/structures';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import type { MailchimpSync } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import type { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { ConnectMailchimpEndpoint } from '../../src/endpoints/organization/dashboard/mailchimp/ConnectMailchimpEndpoint.js';
import { GetMailchimpSyncEndpoint } from '../../src/endpoints/organization/dashboard/mailchimp/GetMailchimpSyncEndpoint.js';
import { PatchMailchimpSettingsEndpoint } from '../../src/endpoints/organization/dashboard/mailchimp/PatchMailchimpSettingsEndpoint.js';
import { StartMailchimpSyncEndpoint } from '../../src/endpoints/organization/dashboard/mailchimp/StartMailchimpSyncEndpoint.js';
import { MailchimpClient } from '../../src/services/mailchimp/MailchimpClient.js';
import { STPackageService } from '../../src/services/STPackageService.js';
import type { MailchimpMocker } from '../helpers/MailchimpMocker.js';
import { testServer } from '../helpers/TestServer.js';
import { initAdmin } from './initAdmin.js';

export async function mailchimpRequest<T>(endpoint: Endpoint<any, any, any, any>, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, host: string, token: Token, body?: unknown): Promise<{ body: T }> {
    const request = Request.buildJson(method, `/v${Version}${path}`, host, body);
    request.headers.authorization = 'Bearer ' + token.accessToken;
    return await testServer.test(endpoint, request) as unknown as { body: T };
}

/**
 * Organization with the members and webshops packages, the mailchimp feature flag and a full access admin
 */
export async function initMailchimpOrganization({ featureFlag = true, members = true } = {}) {
    MailchimpClient.retryDelay = 1;

    const organization = await new OrganizationFactory({ packages: members ? [STPackageBundle.Members, STPackageBundle.Webshops] : [STPackageBundle.Webshops] }).create();
    await STPackageService.updateOrganizationPackages(organization.id);
    await organization.refresh();
    if (featureFlag) {
        organization.privateMeta.featureFlags = ['mailchimp'];
        await organization.save();
    }
    const { admin, adminToken } = await initAdmin({ organization });
    return { organization, admin, token: adminToken, host: organization.getApiHost() };
}

export async function connectMailchimp(mailchimp: MailchimpMocker, { organization, token, host }: { organization: Organization | null; token: Token; host: string }, audienceId = 'list1') {
    await mailchimpRequest(new ConnectMailchimpEndpoint(), 'POST', '/mailchimp/connect', host, token, { apiKey: mailchimp.apiKey });
    await mailchimpRequest(new PatchMailchimpSettingsEndpoint(), 'PATCH', '/mailchimp/settings', host, token, MailchimpSettings.patch({ audienceId }).encode({ version: Version }));
    if (organization) {
        await organization.refresh();
    }
}

/**
 * Starts a synchronisation, waits until it is done and returns the result
 */
export async function runMailchimpSync({ token, host }: { token: Token; host: string }, request: MailchimpSyncRequest) {
    const started = await mailchimpRequest<MailchimpSync>(new StartMailchimpSyncEndpoint(), 'POST', '/mailchimp/syncs', host, token, request.encode({ version: Version }));
    await QueueHandler.awaitAll();
    return (await mailchimpRequest<MailchimpSync>(new GetMailchimpSyncEndpoint(), 'GET', `/mailchimp/syncs/${started.body.id}`, host, token)).body;
}

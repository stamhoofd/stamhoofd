import type { Decoder } from "@simonbackx/simple-encoding";
import { SessionContext, NetworkManager } from "@stamhoofd/networking";
import { Organization } from "@stamhoofd/structures";

export async function idToOrganization(orgId: string) {
    return await fetchOrganization({ path: '/organization', orgId });
}

export async function uriToOrganization(uri: string) {
    return await fetchOrganization({ path: '/organization-from-uri', query: { uri } });
}

export async function domainToOrganization(domain: string) {
    return await fetchOrganization({ path: '/organization-from-domain', query: { domain } });
}

async function fetchOrganization({ path, query, orgId }: { path: string; query?: Record<string, string>; orgId?: string }): Promise<Organization | null> {
    // If we have the token, we better do an authenticated request
    const server = orgId ? SessionContext.serverForOrganization(orgId) : NetworkManager.server;
    try {
        console.log(query);
        const response = await server.request({
            method: 'GET',
            path,
            query,
            decoder: Organization as Decoder<Organization>,
        });
        return response.data;
    } catch (e) {
        console.error('Failed to fetch organization', e);
        return null;
    }
}

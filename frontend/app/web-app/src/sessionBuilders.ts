import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import type { Organization, Platform } from '@stamhoofd/structures';

export async function sessionFromOrganization(organization: Organization, platform: Platform) {
    const session = await SessionContext.createFrom({ organization }, platform);
    await session.loadFromStorage();
    await session.checkSSO();
    await session.checkImpersonation();
    session.updateOrganization(organization);
    session._lastFetchedOrganization = new Date();
    await SessionManager.prepareSessionForUsage(session, false);
    return session;
}

export async function sessionGlobal(platform: Platform) {
    const session = await SessionManager.getLastGlobalSession(platform);
    await session.checkSSO();
    await session.checkImpersonation();
    await SessionManager.prepareSessionForUsage(session, false);
    return session;
}

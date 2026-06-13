import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import type { Organization } from '@stamhoofd/structures';

export async function sessionFromOrganization(organization: Organization) {
    const session = await SessionContext.createFrom({ organization });
    await session.loadFromStorage();
    await session.checkSSO();
    session.updateOrganization(organization);
    session._lastFetchedOrganization = new Date();
    await SessionManager.prepareSessionForUsage(session, false);
    return session;
}

export async function sessionGlobal() {
    const session = await SessionManager.getLastGlobalSession();
    await session.checkSSO();
    await SessionManager.prepareSessionForUsage(session, false);
    return session;
}

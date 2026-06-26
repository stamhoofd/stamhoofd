import { ComponentWithProperties, ModalStackComponent } from '@simonbackx/vue-app-navigation';
import ContextProvider from '@stamhoofd/components/containers/ContextProvider.vue';
import { useAppContext } from '@stamhoofd/components/context/appContext';
import { MemberManager } from '@stamhoofd/networking/MemberManager';
import { OrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { PlatformManager } from '@stamhoofd/networking/PlatformManager';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import type { Organization } from '@stamhoofd/structures';
import { markRaw } from 'vue';

/**
 * Build an authenticated session scoped to a specific organization, reusing the
 * tokens that are already stored for the current (platform) user.
 */
async function sessionForOrganization(organization: Organization) {
    const session = await SessionContext.createFrom({ organization });
    await session.loadFromStorage();
    session.updateOrganization(organization);
    session._lastFetchedOrganization = new Date();
    await SessionManager.prepareSessionForUsage(session, false);
    return session;
}

/**
 * Returns a helper that wraps a component in a context scoped to a specific organization.
 *
 * Views like AdminsView rely on an organization scope being present in the injected
 * context (`$context`, `$organizationManager`, `$platformManager`, `$memberManager`).
 * In the admin dashboard the active context is the global/platform one, so we cannot
 * render those views directly. This helper provides a fresh, organization-scoped set of
 * managers around the given component, while leaving the rest of the injected context
 * (e.g. `stamhoofd_app`) untouched.
 *
 * Usage:
 * ```ts
 * const wrapOrganizationContext = useWrapOrganization();
 *
 * defineRoutes([
 *     {
 *         url: 'beheerders',
 *         component: () => wrapOrganizationContext(organization, new ComponentWithProperties(AdminsView, {})),
 *     },
 * ]);
 * ```
 */
export function useWrapOrganization() {
    const app = useAppContext();

    return async (organization: Organization, component: ComponentWithProperties): Promise<ComponentWithProperties> => {
        const context = await sessionForOrganization(organization);
        const platformManager = await PlatformManager.createFromCache(context, app, true);
        const memberManager = new MemberManager(context, platformManager.$platform);

        return new ComponentWithProperties(ContextProvider, {
            context: markRaw({
                $context: context,
                $platformManager: platformManager,
                $memberManager: memberManager,
                $organizationManager: new OrganizationManager(context),
                stamhoofd_app: app,
            }),
            // Wrap in a ModalStackComponent so that toasts, context menus and popups
            // presented from within are scoped to this organization's context.
            root: new ComponentWithProperties(ModalStackComponent, {
                root: component,
            }),
        });
    };
}

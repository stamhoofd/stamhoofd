import { ComponentWithProperties, ModalStackComponent, NavigationController, UrlHelper } from '@simonbackx/vue-app-navigation';
import type { Organization } from '@stamhoofd/structures';
import { AuthenticatedView, CoverImageContainer, LoginView, RedirectView } from '@stamhoofd/components';

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

function buildComponent(organization: Organization | null) {
    if (STAMHOOFD.REDIRECT_LOGIN_DOMAIN && UrlHelper.initial.getSearchParams().get('skipRedirect') !== 'true') {
        const urlCopy = new URL(UrlHelper.initial.url);
        urlCopy.hostname = STAMHOOFD.REDIRECT_LOGIN_DOMAIN;

        return wrapWithModalStack(new ComponentWithProperties(RedirectView, {
            location: urlCopy.href,
        }));
    }

    const base = new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(LoginView, {
                initialEmail: UrlHelper.shared.getSearchParams().get('email') ?? '',
                organization,
            }),
        }),
    });

    return wrapWithModalStack(base);
}
export async function getAuthComponent(rootAfterLogin: ComponentWithProperties, organization: Organization | null) {
    const root = buildComponent(organization);

    return new ComponentWithProperties(AuthenticatedView, {
        root: wrapWithModalStack(rootAfterLogin),
        loginRoot: wrapWithModalStack(root),
    });
}

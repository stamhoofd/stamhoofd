import { ComponentWithProperties, NavigationController, UrlHelper } from '@simonbackx/vue-app-navigation';
import { CoverImageContainer } from '../containers';
import RedirectView from './RedirectView.vue';
import LoginView from './LoginView.vue';

export function getLoginRoot() {
    if (STAMHOOFD.REDIRECT_LOGIN_DOMAIN && UrlHelper.initial.getSearchParams().get('skipRedirect') !== 'true') {
        const urlCopy = new URL(UrlHelper.initial.url);
        urlCopy.hostname = STAMHOOFD.REDIRECT_LOGIN_DOMAIN;

        return new ComponentWithProperties(RedirectView, {
            location: urlCopy.href,
        });
    }

    const base = new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(LoginView, {
                initialEmail: UrlHelper.shared.getSearchParams().get('email') ?? '',
            }),
        }),
    });

    return base;
}

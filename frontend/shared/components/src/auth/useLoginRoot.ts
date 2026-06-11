import { useAppContext } from '#context/appContext';
import { useContext } from '#hooks/useContext.ts';
import { ComponentWithProperties, NavigationController, UrlHelper } from '@simonbackx/vue-app-navigation';
import { CoverImageContainer, TabBarController, TabBarItem } from '../containers';
import LoginView from './LoginView.vue';
import MembersHomeView from './MembersHomeView.vue';
import RedirectView from './RedirectView.vue';
import { getAppHost } from '@stamhoofd/structures';
import { AppManager } from '@stamhoofd/networking/AppManager';

export function useLoginRoot() {
    const context = useContext();
    const app = useAppContext();

    return function getLoginRoot() {
        if (!AppManager.shared.isNative) {
            if (STAMHOOFD.REDIRECT_LOGIN_DOMAIN && UrlHelper.initial.getSearchParams().get('skipRedirect') !== 'true') {
                const urlCopy = new URL(UrlHelper.initial.url);
                urlCopy.hostname = STAMHOOFD.REDIRECT_LOGIN_DOMAIN;

                return new ComponentWithProperties(RedirectView, {
                    location: urlCopy.href,
                });
            }
        }

        const organization = context.value.organization;

        // In organization mode, greet visitors with an overview of all the groups they can register for
        // (unless a login redirect domain is configured: getLoginRoot handles that redirect)
        if (STAMHOOFD.userMode === 'organization' && organization && organization.meta.packages.useMembers && app !== 'dashboard') {
            // Redirect to custom domain
            // WIP: this doesn't work smooth yet
            // if (!AppManager.shared.isNative) {
            //    try {
            //        const urlCopy = new URL('https://' + getAppHost(app, organization, false));
            //        if (urlCopy.hostname !== window.location.hostname) {
            //        // Redirect
            //            return new ComponentWithProperties(RedirectView, {
            //                location: urlCopy.href,
            //            });
            //        }
            //    } catch (e) {
            //        console.error('Failed to check redirect', e);
            //    }
            // }

            return new ComponentWithProperties(TabBarController, {
                tabs: [
                    new TabBarItem({
                        id: 'start',
                        icon: '',
                        name: '',
                        component: new ComponentWithProperties(NavigationController, {
                            root: new ComponentWithProperties(MembersHomeView, {}),
                        }),
                    }),
                ],
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
    };
}

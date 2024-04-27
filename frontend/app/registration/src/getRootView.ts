import { ComponentWithProperties, ModalStackComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, ContextProvider, PromiseView } from "@stamhoofd/components";
import { OrganizationManager, Session } from "@stamhoofd/networking";

import { CheckoutManager } from "./classes/CheckoutManager";
import { MemberManager } from "./classes/MemberManager";
import HomeView from './views/login/HomeView.vue';
import NewOverviewView from './views/overview/NewOverviewView.vue';

export function getRootView(session: Session) {
    const $memberManager = new MemberManager(session);

    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: session,
            $organizationManager: new OrganizationManager(session),
            $memberManager,
            $checkoutManager: new CheckoutManager($memberManager)
        },
        calculatedContext: () => {
            return {
                $organization: session.organization,
                $user: session.user,
            }
        },
        root: new ComponentWithProperties(AuthenticatedView, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async function (this: PromiseView) {
                    await this.$memberManager.loadMembers();
                    try {
                        await this.$memberManager.loadDocuments();
                    } catch (e) {
                        console.error(e)
                    }

                    return new ComponentWithProperties(ModalStackComponent, {
                        root: new ComponentWithProperties(NavigationController, { 
                            root: new ComponentWithProperties(NewOverviewView, {})
                        })
                    })
                }
            }),
            loginRoot: new ComponentWithProperties(ModalStackComponent, {
                root: new ComponentWithProperties(HomeView, {}) 
            })
        })
    });
}
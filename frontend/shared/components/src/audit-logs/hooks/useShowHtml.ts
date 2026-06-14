import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';


export function useShowHtml() {
    const present = usePresent();

    return async (html: string) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('../SafeHtmlView.vue'), {
                html,
                title: $t(`%yV`),
            }),
        });

        await present({
            components: [component],
            modalDisplayStyle: 'popup',
        });
    };
}

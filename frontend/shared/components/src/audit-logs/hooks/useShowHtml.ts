import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import SafeHtmlView from '../SafeHtmlView.vue';

export function useShowHtml() {
    const present = usePresent();

    return async (html: string) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(SafeHtmlView, {
                html,
                title: $t(`71a1a391-f437-41e4-b2d4-e9e32121d4ee`),
            }),
        });

        await present({
            components: [component],
            modalDisplayStyle: 'popup',
        });
    };
}

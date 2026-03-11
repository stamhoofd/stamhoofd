import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import SafeHtmlView from '../SafeHtmlView.vue';

export function useShowHtml() {
    const present = usePresent();

    return async (html: string) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(SafeHtmlView, {
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

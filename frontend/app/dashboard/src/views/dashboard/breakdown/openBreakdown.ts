import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent';
import type { BreakdownViewProps } from './useBreakdownView';

export type BreakdownOptions = BreakdownViewProps & {
    /**
     * Open in a new popup instead of in the navigation stack that is already visible.
     */
    present?: boolean;
};

/**
 * Opens the breakdown of a selection of payments or balance items, from where the user can narrow it
 * down and export it to Excel.
 */
export function useBreakdown() {
    const present = usePresent();
    const show = useShow();

    async function open(component: ComponentWithProperties, options: BreakdownOptions) {
        if (options.present) {
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, { root: component }),
                ],
                modalDisplayStyle: 'popup',
            });
            return;
        }

        await show({ components: [component] });
    }

    return {
        async openPayments(options: BreakdownOptions) {
            await open(
                AsyncComponent(() => import('./PaymentBreakdownView.vue'), toProps(options)),
                options,
            );
        },

        async openBalanceItems(options: BreakdownOptions) {
            await open(
                AsyncComponent(() => import('./BalanceItemBreakdownView.vue'), toProps(options)),
                options,
            );
        },
    };
}

/**
 * Everything the view needs. Passed on as a whole so a new property is never silently left behind.
 */
function toProps({ present, ...props }: BreakdownOptions): BreakdownViewProps {
    return props;
}

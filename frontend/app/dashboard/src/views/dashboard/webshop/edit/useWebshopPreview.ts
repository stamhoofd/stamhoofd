import { ComponentWithProperties, NavigationController, usePresent } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { useFeatureFlagComputed } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import type { Webshop } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed } from 'vue';

/**
 * The preview of the webshop next to its settings (WebshopPreviewCard), and on full screen
 */
export function useWebshopPreview(webshop: Ref<Webshop>) {
    const present = usePresent();
    const modernWebshopEnabled = useFeatureFlagComputed('modern-webshop');

    // Not in the app: the webshop in the preview only talks to the dashboard on the web
    const showPreview = computed(() => modernWebshopEnabled.value && !AppManager.shared.isNative);

    function openPreview(device?: 'laptop' | 'smartphone') {
        present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: AsyncComponent(() => import('./WebshopFullPreviewView.vue'), {
                        webshop: webshop.value,
                        device,
                    }),
                }),
            ],
            modalDisplayStyle: 'cover',
        }).catch(console.error);
    }

    return { showPreview, openPreview };
}

import type { Product, UitpasEventResponse } from '@stamhoofd/structures';
import { UitpasClientCredentialsStatus } from '@stamhoofd/structures';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';

import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

import { useSetUitpasEvent } from '@stamhoofd/components/uitpas/useSetUitpasEvent.ts';
import type { Ref } from 'vue';
import type { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';

export function useGoToUitpasConfiguration(patchedProduct: Ref<Product>, addProductPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<Product>>) => void) {
    const organization = useRequiredOrganization();
    const present = usePresent();
    const { setUitpasEvent } = useSetUitpasEvent(patchedProduct, addProductPatch);

    const goToUitpasConfiguration = async (onFixed: (navigationActions?: NavigationActions) => Promise<void>) => {
        const isOk = organization.value.meta.uitpasClientCredentialsStatus === UitpasClientCredentialsStatus.Ok;
        const hasEvent = !!patchedProduct.value.uitpasEvent;
        const hasOtherUitpasPrices = patchedProduct.value.prices.some(p => p.uitpasBaseProductPriceId);
        if (hasEvent && !isOk) {
            // fix this in settings
            await goToUitpasSettings(onFixed);
        }
        else if ((!hasEvent && hasOtherUitpasPrices) || (hasEvent && isOk)) {
            // correctly configured or previously decided for non-official flow
            await onFixed();
        }
        else if (!hasEvent && isOk && !hasOtherUitpasPrices) {
            await goToUitpasEventSearch(true, onFixed);
        }
        else { // !hasUrl && !isOk && !hasOtherUitpasPrices
            // ask for non-official or offcial flow
            const useNonOfficial = await CenteredMessage.confirm(
                $t('%1C5'),
                $t('%1C6'),
                $t('%1C7'),
                $t('%1C8'),
                false,
            );

            if (useNonOfficial) {
                await onFixed();
                return;
            }
            await goToUitpasSettings(onFixed);
        }
    };

    const goToUitpasEventSearch = async (showNoteAboutNonOfficialFlow: boolean, onFixed: (navigationActions: NavigationActions) => Promise<void>) => {
        await present(
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('@stamhoofd/components/organizations/components/SearchUitpasEventView.vue'), {
                    title: $t('%1Bs'),
                    selectEvent: async (event: UitpasEventResponse | null, navigationActions: NavigationActions) => {
                        await setUitpasEvent(event);
                        await onFixed(navigationActions);
                        new Toast($t('%1C9'), 'success green').show();
                    },
                    showNoteAboutNonOfficialFlow: showNoteAboutNonOfficialFlow,
                }),
            }).setDisplayStyle('popup'),
        );
    };

    const goToUitpasSettings = async (onFixed: (navigationActions: NavigationActions) => Promise<void>) => {
        await present(
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('../../../settings/UitpasSettingsView.vue'), {
                    initialUitpasEvent: patchedProduct.value.uitpasEvent,
                    onFixedAndEventSelected: async (event: UitpasEventResponse, navigationActions: NavigationActions) => {
                        await setUitpasEvent(event);
                        await onFixed(navigationActions);
                        new Toast($t('%1CA'), 'success green').show();
                    },
                }),
            }).setDisplayStyle('popup'),
        );
    };

    return {
        goToUitpasConfiguration,
        goToUitpasEventSearch,
        goToUitpasSettings,
    };
}

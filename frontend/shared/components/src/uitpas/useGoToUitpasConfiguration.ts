import { Product, UitpasClientCredentialsStatus, UitpasEventResponse } from '@stamhoofd/structures';
import { CenteredMessage, NavigationActions, SearchUitpasEventView, Toast, useRequiredOrganization } from '@stamhoofd/components';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import UitpasSettingsView from '@stamhoofd/dashboard/src/views/dashboard/settings/UitpasSettingsView.vue';
import { useSetUitpasEvent } from './useSetUitpasEvent';
import { Ref } from 'vue';
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';

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
                $t('5410f959-ba95-4c7e-9331-1d1147ac85b2'),
                $t('7646c809-e882-46d6-9a5a-24e83087f70e'),
                $t('6cd858a4-8cc5-42fc-9ca2-a87d1ee13d6b'),
                $t('b59d4150-23bd-4014-9600-37b2ef667e06'),
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
                root: new ComponentWithProperties(SearchUitpasEventView, {
                    title: $t('d37c7255-33dd-42a8-872d-0c719307f842'),
                    selectEvent: async (event: UitpasEventResponse | null, navigationActions: NavigationActions) => {
                        await setUitpasEvent(event);
                        await onFixed(navigationActions);
                        new Toast($t('235434e9-4d87-49a9-b4ce-26e7ee397b62'), 'success green').show();
                    },
                    showNoteAboutNonOfficialFlow: showNoteAboutNonOfficialFlow,
                }),
            }).setDisplayStyle('popup'),
        );
    };

    const goToUitpasSettings = async (onFixed: (navigationActions: NavigationActions) => Promise<void>) => {
        await present(
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UitpasSettingsView, {
                    initialUitpasEvent: patchedProduct.value.uitpasEvent,
                    onFixedAndEventSelected: async (event: UitpasEventResponse, navigationActions: NavigationActions) => {
                        await setUitpasEvent(event);
                        await onFixed(navigationActions);
                        new Toast($t('7e0a683f-f409-4fbe-b463-46ec451951cd'), 'success green').show();
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

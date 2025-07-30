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
                $t('Je gebruikt de niet-officiële UiTPAS-flow'),
                $t('Doorgaan zonder terugbetalingen'),
                $t('De toegepaste kortingen worden niet geregistreerd en je ontvangt geen automatische terugbetaling van UiTPAS. Wil je dit toch, configureer dan je UiTPAS-integratie in de instellingen.'),
                $t('Ga naar instellingen'),
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
                    title: $t('Zoek je UiTPAS-evenement'),
                    selectEvent: async (event: UitpasEventResponse | null, navigationActions: NavigationActions) => {
                        await setUitpasEvent(event);
                        await onFixed(navigationActions);
                        new Toast($t('UiTPAS evenement gekoppeld'), 'success green').show();
                    },
                    showNoteAboutNonOfficialFlow: showNoteAboutNonOfficialFlow,
                }),
            }).setDisplayStyle('popup'),
        );
    };

    const goToUitpasSettings = async (onFixed: (navigationActions: NavigationActions) => Promise<void>) => {
        console.error('Product:', patchedProduct?.value);
        await present(
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UitpasSettingsView, {
                    initialUitpasEvent: patchedProduct.value.uitpasEvent,
                    onFixedAndEventSelected: async (event: UitpasEventResponse, navigationActions: NavigationActions) => {
                        await setUitpasEvent(event);
                        await onFixed(navigationActions);
                        new Toast($t('UiTPAS gekoppeld'), 'success green').show();
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

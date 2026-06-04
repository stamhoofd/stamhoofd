<template>
    <div class="st-view onboarding-start-view shade" data-testid="onboarding-start-view">
        <STNavigationBar :title="$t('Welkom bij Stamhoofd')" />

        <main class="center">
            <h1 class="style-navigation-title">
                {{ $t('Welkom bij Stamhoofd') }}
            </h1>
            <p class="style-description-block">
                {{ $t('Waarmee wil je starten? Je kan dit later altijd uitbreiden.') }}
            </p>

            <div class="onboarding-options">
                <button type="button" class="onboarding-option" @click="startMemberAdministration">
                    <figure>
                        <IconContainer icon="team" class="secundary" />
                    </figure>
                    <h2>{{ $t('Onze leden beheren') }}</h2>
                    <p class="style-description">
                        {{ $t('Ledenportaal, inschrijvingen, kalender en lidgeld op één plek.') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Voor clubs met vaste leden') }}
                    </p>
                </button>

                <button type="button" class="onboarding-option" @click="startSelling">
                    <figure>
                        <IconContainer icon="basket" class="success" />
                    </figure>
                    <h2>{{ $t('Iets verkopen of verzamelen') }}</h2>
                    <p class="style-description">
                        {{ $t('Tickets, webshop, inschrijvingen of een gift.') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Voor evenementen of een actie') }}
                    </p>
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { GlobalEventBus, Toast, useRequiredOrganization, useUser } from '@stamhoofd/components';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { OrganizationCheckout, PackagePurchases, PaymentCustomer, PaymentMethod, STPackageBundle } from '@stamhoofd/structures';
import { useActivatePackages } from '../dashboard/settings/packages/hooks/useActivatePackages';
import EditWebshopGeneralView from '../dashboard/webshop/edit/EditWebshopGeneralView.vue';
import { useMemberAdministrationOnboarding } from './useMemberAdministrationOnboarding';
import BoxedController from '@stamhoofd/components/containers/BoxedController.vue';

const startMemberAdministrationOnboarding = useMemberAdministrationOnboarding();
const show = useShow();
const activatePackages = useActivatePackages();
const user = useUser();
const organization = useRequiredOrganization();

async function startMemberAdministration() {
    await startMemberAdministrationOnboarding({
        displayOptions: {
            action: 'show',
        },
    });
}

async function activateWebshopsTrial() {
    try {
        await activatePackages(
            OrganizationCheckout.create({
                purchases: PackagePurchases.create({
                    packageBundles: [STPackageBundle.TrialWebshops],
                }),
                paymentMethod: PaymentMethod.Unknown,
                customer: PaymentCustomer.create({
                    firstName: user.value?.firstName,
                    lastName: user.value?.lastName,
                    email: user.value?.email,
                    company: organization.value.defaultCompanies[0],
                }),
            }),
        );
    } catch (e) {
        Toast.fromError(e).show();
        return;
    }

    // go to the webshop tab
    await GlobalEventBus.sendEvent('selectTabById', 'webshops');
}

async function startSelling() {
    if (organization.value.webshops.length > 0) {
        return await activateWebshopsTrial();
    }
    await show({
        components: [
            new ComponentWithProperties(BoxedController, {
                root: new ComponentWithProperties(EditWebshopGeneralView, {
                    savedHandler: async () => {
                        return await activateWebshopsTrial();
                    },
                }),
            }),
        ],
    });
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.onboarding-start-view {
    h1, main > p {
        text-align: center;
    }
}
</style>

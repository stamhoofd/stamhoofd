<template>
    <div class="st-view onboarding-start-view shade" data-testid="onboarding-start-view">
        <STNavigationBar :title="$t('%1Wp')" />

        <main class="center">
            <h1 class="style-navigation-title">
                {{ $t('%1Wp') }}
            </h1>
            <p class="style-description-block">
                {{ $t('%1Un') }}
            </p>

            <div class="onboarding-options">
                <button type="button" class="onboarding-option" @click="startMemberAdministration">
                    <figure>
                        <IconContainer icon="team" class="secundary" />
                    </figure>
                    <h2>{{ $t('%1X9') }}</h2>
                    <p class="style-description">
                        {{ $t('%1Uv') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%1UZ') }}
                    </p>
                </button>

                <button type="button" class="onboarding-option" @click="startSelling">
                    <figure>
                        <IconContainer icon="basket" class="success" />
                    </figure>
                    <h2>{{ $t('%1VY') }}</h2>
                    <p class="style-description">
                        {{ $t('%1Vd') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%1Wo') }}
                    </p>
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { GlobalEventBus } from '@stamhoofd/components/EventBus';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { useUser } from '@stamhoofd/components/hooks/useUser';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { OrganizationCheckout, PackagePurchases, PaymentCustomer, PaymentMethod, STPackageBundle } from '@stamhoofd/structures';
import { useActivatePackages } from '../dashboard/settings/packages/hooks/useActivatePackages';

import { useMemberAdministrationOnboarding } from './useMemberAdministrationOnboarding';


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
            AsyncComponent(() => import('@stamhoofd/components/containers/BoxedController.vue'), {
                root: AsyncComponent(() => import('../dashboard/webshop/edit/EditWebshopGeneralView.vue'), {
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

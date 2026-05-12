<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="mandates !== null && packageStatus" class="st-view">
            <STNavigationBar :title="title" />

            <main>
                <h1 class="style-navigation-title">
                    {{ title }}
                </h1>

                <STErrorsDefault :error-box="errors.errorBox" />

                <div class="container">
                    <hr>
                    <h2 class="style-with-button">
                        <div>{{ $t('Betaalmethodes') }}</div>
                    </h2>

                    <p v-if="mandates.length === 0" class="info-box">
                        {{ $t('Geen mandaten') }}
                    </p>
                    <STGrid v-else>
                        <PaymentMandateRow v-for="mandate of mandates" :key="mandate.id" :mandate="mandate" :selectable="false">
                            <template #right>
                                <LoadingButton :loading="deletingMandates.has(mandate.id)">
                                    <button v-tooltip="$t('Ontkoppel deze kaart')" type="button" class="button icon trash" @click.stop="deleteMandate(mandate.id)" />
                                </LoadingButton>
                            </template>
                        </PaymentMandateRow>
                    </STGrid>
                </div>

                <div class="container">
                    <hr>
                    <h2 class="style-with-button">
                        <div>{{ $t('Pakketten') }}</div>
                        <div class="hover-show">
                            <button class="button icon gray add" type="button" @click="createPackage()" />
                        </div>
                    </h2>

                    <p v-if="packageStatus.packages.length === 0" class="info-box">
                        {{ $t('%1Pn') }}
                    </p>
                    <STList v-else>
                        <STPackageRow v-for="pack of packageStatus.packages" :key="pack.id" :pack="pack" :selectable="true" @click="editPackage(pack)" />
                    </STList>
                </div>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox, useContext, useErrors, usePlatform } from '@stamhoofd/components';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import STPackageRow from '@stamhoofd/components/packages/STPackageRow.vue';
import { useRequestOwner } from '@stamhoofd/networking';
import type { Organization, STPackage } from '@stamhoofd/structures';
import { OrganizationPackagesStatus, STPackageBundle, STPackageBundleHelper } from '@stamhoofd/structures';
import { onMounted, ref } from 'vue';
import EditPackageView from './EditPackageView.vue';
import { useOrganizationPaymentMandates } from '@stamhoofd/components/mandates/useOrganizationPaymentMandates';
import PaymentMandateRow from '@stamhoofd/components/mandates/PaymentMandateRow.vue';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';

const props = withDefaults(
    defineProps<{
        organization: Organization;
    }>(),
    {
    });

const title = $t('%1Mm');

const packageStatus = ref<null | OrganizationPackagesStatus>(null);
const errors = useErrors();
const loading = ref(false);
const context = useContext();
const owner = useRequestOwner();
const present = usePresent()
const platform = usePlatform();

const {mandates, deleteMandate: doDeleteMandate, deletingMandates} = useOrganizationPaymentMandates({
    payingOrganizationId: props.organization.id,
    sellerOrganizationId: platform.value.membershipOrganizationId!,
    errors,
});

onMounted(() => {
    reload().catch(console.error)
});

async function reload() {
    if (loading.value) {
        // Should not really happen
        return;
    }

    loading.value = true;

    try {
        const response = await context.value.getAuthenticatedServerForOrganization(props.organization.id).request({
            method: 'GET',
            path: '/organization/packages',
            query: {
                includeExpired: true
            },
            owner,
            decoder: OrganizationPackagesStatus as Decoder<OrganizationPackagesStatus>,
        });

        packageStatus.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    loading.value = false;
}

async function deleteMandate(mandateId: string) {
    if (!await CenteredMessage.confirm({
        title: $t('Ben je zeker dat je dit mandaat wilt verwijderen?'),
        description: $t('Dit kan ervoor zorgen dat we geen openstaande bedragen kunnen innen van deze vereniging'),
        requireCheckbox: $t('Ja, verwijder dit mandaat'),
        confirmText: $t('Verwijderen'),
        destructive: true
    })) {
        return;
    }
    await doDeleteMandate(mandateId)
}

async function createPackage() {
    const pack = STPackageBundleHelper.getCurrentPackage(STPackageBundle.Webshops, new Date())
    pack.validAt = new Date()
    
    await present({
        components: [
            new ComponentWithProperties(EditPackageView, {
                pack,
                isNew: true,
                saveHandler: async (patch: AutoEncoderPatchType<STPackage>) => {
                    const status = OrganizationPackagesStatus.patch({});
                    status.packages.addPut(pack.patch(patch));
                    await applyPatch(status)
                }
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

async function editPackage(pack: STPackage) {
    await present({
        components: [
            new ComponentWithProperties(EditPackageView, {
                pack,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<STPackage>) => {
                    const status = OrganizationPackagesStatus.patch({});
                    patch.id = pack.id;
                    status.packages.addPatch(patch)
                    await applyPatch(status)
                }
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

async function applyPatch(patch: AutoEncoderPatchType<OrganizationPackagesStatus>) {
    const response = await context.value.getAuthenticatedServerForOrganization(props.organization.id).request({
        method: "PATCH",
        path: "/organization/packages",
        body: patch,
        decoder: OrganizationPackagesStatus as Decoder<OrganizationPackagesStatus>
    })
    packageStatus.value = response.data
}


</script>

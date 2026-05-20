<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="packageStatus" class="st-view">
            <STNavigationBar :title="title" />

            <main>
                <h1 class="style-navigation-title">
                    {{ title }}
                </h1>

                <STErrorsDefault :error-box="errors.errorBox" />

                <div class="container">
                    <hr>
                    <h2 class="style-with-button">
                        <div>{{ $t('%1UB') }}</div>
                    </h2>
                    <PaymentMandatesBox :paying-organization-id="organization.id" :selling-organization-id="platform.membershipOrganizationId!" />
                </div>

                <div class="container">
                    <hr>
                    <h2 class="style-with-button">
                        <div>{{ $t('%1Qj') }}</div>
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
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';
import PaymentMandatesBox from '@stamhoofd/components/mandates/PaymentMandatesBox.vue';
import { useOrganizationPaymentMandates } from '@stamhoofd/components/mandates/useOrganizationPaymentMandates';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage';
import STPackageRow from '@stamhoofd/components/packages/STPackageRow.vue';
import { useRequestOwner } from '@stamhoofd/networking';
import type { Organization, STPackage } from '@stamhoofd/structures';
import { OrganizationPackagesStatus, STPackageBundle, STPackageBundleHelper } from '@stamhoofd/structures';
import { onMounted, ref } from 'vue';
import EditPackageView from './EditPackageView.vue';

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

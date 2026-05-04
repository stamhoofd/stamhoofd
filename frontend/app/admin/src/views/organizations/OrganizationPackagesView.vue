<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="packageStatus" class="st-view">
            <STNavigationBar :title="title" />

            <main>
                <h1 class="style-navigation-title">
                    {{ title }}
                </h1>

                <div class="container">
                    <hr>
                    <h2 class="style-with-button">
                        <div>Pakketten</div>
                        <div class="hover-show">
                            <button class="button icon gray add" type="button" @click="createPackage()" />
                        </div>
                    </h2>

                    <p v-if="packageStatus.packages.length === 0" class="info-box">
                        {{ $t('Geen pakketten') }}
                    </p>
                    <STList v-else>
                        <STListItem v-for="pack of packageStatus.packages" :key="pack.id" :selectable="true" @click="editPackage(pack)">
                            <template #left>
                                <IconContainer :icon="pack.meta.isWebshops ? 'basket' : 'group'" :class="{'gray': !pack.status.isActive, 'secundary': pack.status.isActive && pack.meta.isTrial}">
                                    <template #aside>
                                        <span v-if="pack.meta.isTrial" v-tooltip="'Momenteel in proefperiode, activeer om in gebruik te nemen'" :class="'icon trial small stroke ' + (pack.status.isActive ? 'secundary' : '')" />
                                        <span v-else-if="pack.status.isActive" v-tooltip="'Deze functie is actief'" class="icon success small primary" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h3 class="style-title-list">
                                {{ pack.meta.name }}
                            </h3>
                            <p v-if="pack.meta.startDate" class="style-description-small">
                                Vanaf {{ formatDateTime(pack.meta.startDate) }}
                            </p>
                            <p v-if="pack.validUntil" class="style-description-small">
                                Geldig tot {{ formatDateTime(pack.validUntil) }}
                            </p>
                        </STListItem>
                    </STList>
                </div>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox, useContext, useErrors } from '@stamhoofd/components';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { useRequestOwner } from '@stamhoofd/networking';
import { STPackageBundle, STPackageBundleHelper, STPackageMeta  } from '@stamhoofd/structures';
import type {Organization, STPackage} from '@stamhoofd/structures';
import { OrganizationPackagesStatus, STPackageType } from '@stamhoofd/structures';
import { onMounted, ref } from 'vue';
import EditPackageView from './EditPackageView.vue';

const props = withDefaults(
    defineProps<{
        organization: Organization;
    }>(),
    {
    });

const title = $t('Facturatie');

const packageStatus = ref<null | OrganizationPackagesStatus>(null);
const errors = useErrors();
const loading = ref(false);
const context = useContext();
const owner = useRequestOwner();
const present = usePresent()

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

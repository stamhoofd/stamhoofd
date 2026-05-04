<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasWrite" class="button icon edit" type="button" :v-tooltip="$t(`%Go`)" @click="editOrganization" />
                <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('%Gk')" @click="goBack" />
                <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('%Gl')" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <aside v-copyable class="style-title-prefix style-copyable">
                {{ organization.uri }}
            </aside>
            <h1 v-copyable class="style-navigation-title style-copyable">
                {{ title }}
            </h1>

            <p v-if="!organization.active" class="error-box">
                {{ $t('%Gm') }}
            </p>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%Cn') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ organization.address }}
                    </p>
                </STListItem>

                <STListItem v-for="company of organization.meta.companies" :key="company.id">
                    <h3 class="style-definition-label">
                        {{ $t('%1Ke') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ company.name }}
                    </p>
                    <p v-if="company.VATNumber" v-copyable class="style-description-small style-copyable">
                        {{ company.VATNumber }} {{ $t('%Gn') }}
                    </p>
                    <p v-else-if="company.companyNumber" v-copyable class="style-description-small style-copyable">
                        {{ company.companyNumber }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('%1CH') }}
                    </p>

                    <p v-if="company.address" v-copyable class="style-description-small style-copyable">
                        {{ company.address }}
                    </p>
                </STListItem>

                <STListItem v-if="organization.website" element-name="a" :href="organization.website" :selectable="true" target="_blank">
                    <h3 class="style-definition-label">
                        {{ $t('%G') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.website }}
                    </p>

                    <template #right>
                        <button class="button icon external" type="button" />
                    </template>
                </STListItem>

                <STListItem v-if="!$isPlatform">
                    <h3 class="style-definition-label">
                        {{ $t('%6t') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(organization.createdAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="!$isPlatform && organization.privateMeta">
                    <h3 class="style-definition-label">
                        {{ $t('%1z') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.privateMeta?.acquisitionTypes?.length ? organization.privateMeta.acquisitionTypes.join(', ') : $t('Onbekend') }}
                    </p>
                </STListItem>

                <STListItem :selectable="hasWrite" @click="hasWrite ? editOrganization() : undefined">
                    <h3 class="style-definition-label">
                        {{ $t('%3G') }}
                    </h3>
                    <p class="style-definition-text" :class="{placeholder: tagStringList.length === 0}">
                        {{ tagStringList || 'Geen' }}
                    </p>

                    <template #right>
                        <span v-if="hasWrite" class="icon edit gray" />
                    </template>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('Aantal leden' ) }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        <MemberCountSpan
                            :filter="memberCountFilter"
                        />
                    </p>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('%6u') }}</h2>

            <p>{{ $t('Deze functies verhuizen in de toekomst grotendeels naar het administratieportaal zelf. Voorlopig zijn de acties bereikbaar via het beheerdersportaal.' ) }}</p>

            <STList class="illustration-list">
                <STListItem v-if="!$isPlatform" :selectable="true" class="left-center right-stack" @click="navigate(Routes.Invoices)">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/transfer.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('Facturatie') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('Bekijk facturen, openstaande bedragen en mandaten') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center right-stack" element-name="a" :href="'/' + appToUri('dashboard') + '/' + organization.uri + '/instellingen'" :target="$isMobile ? undefined : '_blank'">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%xU') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3F') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center right-stack" element-name="a" :href="'/' + appToUri('dashboard') + '/' + organization.uri + '/leden'" :target="$isMobile ? undefined : '_blank'">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%1EH') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%32') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center right-stack" element-name="a" :href="'/' + appToUri('dashboard') + '/' + organization.uri" :target="$isMobile ? undefined : '_blank'">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/laptop-key.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%6v') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%3B') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>
            </STList>

            <ViewOrganizationRecordCategoriesBox :organization="organization" />

            <div v-if="setupSteps.steps.size" class="container">
                <hr><h2>{{ $t('%6Z') }}</h2>
                <SetupStepRows :steps="setupSteps" list-type="review" />
            </div>

            <hr><h2>
                {{ $t('%31') }}
            </h2>

            <LoadingButton :loading="deleting">
                <button class="button secundary danger" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>{{ $t('%CJ') }}</span>
                </button>
            </LoadingButton>
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, useNavigate, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import MemberCountSpan from '@stamhoofd/components/members/components/MemberCountSpan.vue';
import SetupStepRows from '@stamhoofd/components/setupSteps/SetupStepRows.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useBackForward } from '@stamhoofd/components/hooks/useBackForward.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { appToUri, Organization } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import EditOrganizationView from './EditOrganizationView.vue';
import ViewOrganizationRecordCategoriesBox from './components/ViewOrganizationRecordCategoriesBox.vue';
import OrganizationInvoicesView from './OrganizationInvoicesView.vue';

const props = defineProps<{
    organization: Organization;
    getNext: (current: Organization) => Organization | null;
    getPrevious: (current: Organization) => Organization | null;
}>();
const navigate = useNavigate()

enum Routes {
    Invoices = 'invoices',
}

defineRoutes([
    {
        url: Routes.Invoices,
        component: OrganizationInvoicesView,
        paramsToProps() {
            return {
                organization: props.organization
            };
        },
    }
])

const isPlatform = STAMHOOFD.userMode === 'platform';

const context = useContext();
const owner = useRequestOwner();
const pop = usePop();
const platform = usePlatform();
const present = usePresent();
const { goBack, goForward, hasNext, hasPrevious } = useBackForward('organization', props);

const memberCountFilter: StamhoofdFilter = {
    registrations: {
        $elemMatch: {
            organizationId: props.organization.id,
            periodId: isPlatform ? platform.value.period.id : props.organization.period.period.id,
        },
    },
};

const title = computed(() => {
    return props.organization.name;
});

const tagStringList = computed(() => {
    return props.organization.meta.tags.map(id => platform.value.config.tags.find(t => t.id === id)?.name ?? $t(`%15v`)).join(', ');
});

const setupSteps = computed(() => props.organization.period.setupSteps);
const auth = useAuth();

const deleting = ref(false);
const hasWrite = computed(() => auth.getPermissionsForOrganization(props.organization)?.hasFullAccess() ?? false);

async function editOrganization() {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationView, {
                organization: props.organization,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                    const response = await context.value.getAuthenticatedServerForOrganization(props.organization.id).request({
                        method: 'PATCH',
                        path: '/organization',
                        body: patch,
                        shouldRetry: false,
                        owner,
                        decoder: Organization as Decoder<Organization>,
                    });

                    props.organization.deepSet(response.data);
                },
            }),
        ],
    });
}

async function deleteMe() {
    if (deleting.value) {
        return;
    }
    deleting.value = true;

    if (!await CenteredMessage.confirm($t('%35'), $t('%55'), $t('%vT'))) {
        deleting.value = false;
        return;
    }

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Second confirmation window

    if (!await CenteredMessage.confirm($t('%36'), $t('%55'), $t('%vT'))) {
        deleting.value = false;
        return;
    }

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (!await CenteredMessage.confirm($t('%37'), $t('%55'), $t('%vT'))) {
        deleting.value = false;
        return;
    }

    // Verwijderen

    const patch: PatchableArrayAutoEncoder<Organization> = new PatchableArray();
    patch.addDelete(props.organization.id);

    try {
        await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/admin/organizations',
            body: patch,
            shouldRetry: false,
            owner,
        });

        GlobalEventBus.sendEvent('organizations-deleted', [props.organization]).catch(console.error);
        Toast.success($t('%1LO')).show();
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    deleting.value = false;
}

</script>

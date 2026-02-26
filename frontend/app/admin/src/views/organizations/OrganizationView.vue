<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasWrite" class="button icon edit" type="button" :v-tooltip="$t(`d327935e-c900-4231-a572-1a7f7821654f`)" @click="editOrganization" />
                <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('bdd3230e-7a76-4b7a-b9a8-60bdf200d464')" @click="goBack" />
                <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('88b87e7b-add1-4551-8135-a1d3dc96da9c')" @click="goForward" />
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
                {{ $t('8ccdb08d-3127-4fc7-ba15-5a0af262bcc8') }}
            </p>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('622c0dd7-cddd-4417-9bfd-5f6aca2480f5') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ organization.address }}
                    </p>
                </STListItem>

                <STListItem v-for="company of organization.meta.companies" :key="company.id">
                    <h3 class="style-definition-label">
                        {{ $t('3dae9ed2-c904-448a-834e-c60bfaed88d1') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ company.name }}
                    </p>
                    <p v-if="company.VATNumber" v-copyable class="style-description-small style-copyable">
                        {{ company.VATNumber }} {{ $t('9f72f8ee-74c7-4757-b1dc-948f632114f2') }}
                    </p>
                    <p v-else-if="company.companyNumber" v-copyable class="style-description-small style-copyable">
                        {{ company.companyNumber }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('594307a3-05b8-47cf-81e2-59fb6254deba') }}
                    </p>

                    <p v-if="company.address" v-copyable class="style-description-small style-copyable">
                        {{ company.address }}
                    </p>
                </STListItem>

                <STListItem v-if="organization.website" element-name="a" :href="organization.website" :selectable="true" target="_blank">
                    <h3 class="style-definition-label">
                        {{ $t('00c90aa3-2d42-45bc-a3e7-56565b7a4e0e') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.website }}
                    </p>

                    <template #right>
                        <button class="button icon external" type="button" />
                    </template>
                </STListItem>

                <STListItem v-if="!isPlatform">
                    <h3 class="style-definition-label">
                        {{ $t('8565df22-3559-44b1-be1f-de9d1c3a7837') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(organization.createdAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="!isPlatform && organization.privateMeta">
                    <h3 class="style-definition-label">
                        {{ $t('bf20a769-772d-46b2-9b48-2ea29c96f113') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.privateMeta?.acquisitionTypes.join(', ') }}
                    </p>
                </STListItem>

                <STListItem :selectable="hasWrite" @click="hasWrite ? editOrganization() : undefined">
                    <h3 class="style-definition-label">
                        {{ $t('0be39baa-0b8e-47a5-bd53-0feeb14a0f93') }}
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

            <hr><h2>{{ $t('f18beb62-a9e8-4881-865c-28ad534b6f24') }}</h2>

            <p>{{ $t('Deze functies verhuizen in de toekomst grotendeels naar het administratieportaal zelf. Voorlopig zijn de acties bereikbaar via het beheerdersportaal.' ) }}</p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center right-stack" element-name="a" :href="'/' + appToUri('dashboard') + '/' + organization.uri + '/instellingen'" :target="$isMobile ? undefined : '_blank'">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('9a6474d8-0bb5-4760-8dca-e85ba79035ce') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('a5b61d4d-207f-485c-8748-cbb04fcb2d23') }}
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
                        {{ $t('c3158561-e0dc-4dd5-8581-d2d861238946') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('eb91fb5c-72fc-44d4-9b84-4c9f7791e27a') }}
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
                        {{ $t('bda3721a-3b39-4409-9407-e0b3abde0009') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('2300284a-a015-4c97-8ad1-6c9f2bbde174') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>
            </STList>

            <ViewOrganizationRecordCategoriesBox :organization="organization" />

            <div v-if="setupSteps.steps.size" class="container">
                <hr><h2>{{ $t('6355a1b9-7b98-48c4-9aca-91df9a22d66e') }}</h2>
                <SetupStepRows :steps="setupSteps" list-type="review" />
            </div>

            <hr><h2>
                {{ $t('f477755c-2d6e-473c-b9b9-2ebe0af173f3') }}
            </h2>

            <LoadingButton :loading="deleting">
                <button class="button secundary danger" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>{{ $t('838cae8b-92a5-43d2-82ba-01b8e830054b') }}</span>
                </button>
            </LoadingButton>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, GlobalEventBus, MemberCountSpan, SetupStepRows, Toast, useAuth, useBackForward, useContext, usePlatform } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { appToUri, Organization, StamhoofdFilter } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import EditOrganizationView from './EditOrganizationView.vue';
import ViewOrganizationRecordCategoriesBox from './components/ViewOrganizationRecordCategoriesBox.vue';

const props = defineProps<{
    organization: Organization;
    getNext: (current: Organization) => Organization | null;
    getPrevious: (current: Organization) => Organization | null;
}>();

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
    return props.organization.meta.tags.map(id => platform.value.config.tags.find(t => t.id === id)?.name ?? $t(`2c848249-09d3-46b4-b09e-ea3357add631`)).join(', ');
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

    if (!await CenteredMessage.confirm($t('92c19888-7ac0-46b5-b691-05b29e52e110'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), $t('9a528611-db36-4bb0-9de4-29b653ea6165'))) {
        deleting.value = false;
        return;
    }

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Second confirmation window

    if (!await CenteredMessage.confirm($t('2be85b13-52d6-4322-adcc-b491b5749422'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), $t('9a528611-db36-4bb0-9de4-29b653ea6165'))) {
        deleting.value = false;
        return;
    }

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (!await CenteredMessage.confirm($t('6435b870-2298-49bb-bd28-904e864178d3'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), $t('9a528611-db36-4bb0-9de4-29b653ea6165'))) {
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
        Toast.success($t('De vereniging werd verwijderd')).show();
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    deleting.value = false;
}

</script>

<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasWrite" v-tooltip="'Bewerken'" class="button icon navigation edit" type="button" @click="editOrganization" />
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar vorige groep'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende groep'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goNext" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <p v-if="!organization.active" class="error-box">
                Deze groep is inactief. Deze kan niet meer gebruikt worden en bestaat enkel nog voor archiveringsdoeleinden.
            </p>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('622c0dd7-cddd-4417-9bfd-5f6aca2480f5') }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        {{ organization.address }}
                    </p>
                    <p v-if="organization.meta.companyAddress && organization.meta.companyAddress !== organization.address" class="style-description-small">
                        {{ $t('10c2c710-3c0d-445b-bb2e-c3f43cd6397b') }}: {{ organization.meta.companyAddress }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('3dae9ed2-c904-448a-834e-c60bfaed88d1') }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        {{ organization.meta.companyName || organization.name }}
                    </p>
                    <p v-if="organization.meta.companyAddress" v-copyable class="style-description-small">
                        {{ organization.meta.companyAddress }}
                    </p>
                    <p v-copyable class="style-description-small">
                        {{ organization.meta.VATNumber || organization.meta.companyNumber || 'Geen ondernemingsnummer' }}
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
                        Aangesloten sinds
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(organization.createdAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="!isPlatform && organization.privateMeta">
                    <h3 class="style-definition-label">
                        Via
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.privateMeta?.acquisitionTypes.join(', ') }}
                    </p>
                </STListItem>

                <STListItem :selectable="hasWrite" @click="hasWrite ? editTags : undefined">
                    <h3 class="style-definition-label">
                        Tags
                    </h3>
                    <p class="style-definition-text" :class="{placeholder: tagStringList.length === 0}">
                        {{ tagStringList || 'Geen tags' }}
                    </p>

                    <template #right>
                        <span v-if="hasWrite" class="icon edit gray" />
                    </template>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Aantal leden
                    </h3>
                    <p v-copyable class="style-definition-text">
                        <MemberCountSpan
                            :filter="{
                                registrations: {
                                    $elemMatch: {
                                        organizationId: organization.id,
                                        periodId: platform.period.id
                                    }
                                }
                            }"
                        />
                    </p>
                </STListItem>
            </STList>

            <hr>

            <h2>Navigatie</h2>

            <p>Deze functies verhuizen in de toekomst grotendeels naar het administratieportaal zelf. Voorlopig zijn de acties bereikbaar via het beheerdersportaal.</p>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center right-stack" element-name="a" :href="'/beheerders/' + organization.uri + '/instellingen'" target="_blank">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        Instellingen
                    </h2>
                    <p class="style-description">
                        {{ $t('a5b61d4d-207f-485c-8748-cbb04fcb2d23') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center right-stack" element-name="a" :href="'/beheerders/' + organization.uri + '/leden'" target="_blank">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 class="style-title-list">
                        Leden
                    </h2>
                    <p class="style-description">
                        {{ $t('eb91fb5c-72fc-44d4-9b84-4c9f7791e27a') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center right-stack" element-name="a" :href="'/beheerders/' + organization.uri" target="_blank">
                    <template #left>
                        <img src="~@stamhoofd/assets/images/illustrations/laptop-key.svg">
                    </template>
                    <h2 class="style-title-list">
                        Beheerdersportaal
                    </h2>
                    <p class="style-description">
                        {{ $t('2300284a-a015-4c97-8ad1-6c9f2bbde174') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>
            </STList>

            <div v-if="setupSteps.steps.size" class="container">
                <hr>
                <h2>{{ $t('6355a1b9-7b98-48c4-9aca-91df9a22d66e') }}</h2>
                <SetupStepRows :steps="setupSteps" list-type="review" />
            </div>

            <hr>
            <h2>
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
import { ComponentWithProperties, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, MemberCountSpan, SetupStepRows, Toast, useAuth, useContext, useKeyUpDown, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { computed, getCurrentInstance, ref } from 'vue';
import EditOrganizationView from './EditOrganizationView.vue';
import SelectOrganizationTagsView from './tags/SelectOrganizationTagsView.vue';

const props = defineProps<{
    organization: Organization;
    getNext: (current: Organization) => Organization | null;
    getPrevious: (current: Organization) => Organization | null;
}>();

const show = useShow();
const isPlatform = STAMHOOFD.userMode === 'platform';
const $t = useTranslate();
const context = useContext();
const owner = useRequestOwner();
const pop = usePop();
const platform = usePlatform();
const present = usePresent();

useKeyUpDown({
    up: goBack,
    down: goNext,
});

const title = computed(() => {
    return props.organization.name;
});

const hasPrevious = computed(() => {
    if (!props.getPrevious) {
        return false;
    }
    return !!props.getPrevious(props.organization);
});

const hasNext = computed(() => {
    if (!props.getNext) {
        return false;
    }
    return !!props.getNext(props.organization);
});

const tagStringList = computed(() => {
    return props.organization.meta.tags.map(id => platform.value.config.tags.find(t => t.id === id)?.name ?? 'onbekend').join(', ');
});

const setupSteps = computed(() => props.organization.period.setupSteps);

const instance = getCurrentInstance();
const auth = useAuth();

async function seek(previous = true) {
    const organization = previous ? props.getPrevious(props.organization) : props.getNext(props.organization);
    if (!organization) {
        return;
    }
    const component = new ComponentWithProperties(instance!.type, {
        ...props,
        organization,
    });

    await show({
        components: [component],
        replace: 1,
        reverse: previous,
        animated: false,
    });
}

async function goBack() {
    await seek(true);
}

async function goNext() {
    await seek(false);
}

const deleting = ref(false);
const hasWrite = computed(() => auth.getPermissionsForOrganization(props.organization)?.hasFullAccess() ?? false);

async function editTags() {
    await show({
        components: [
            new ComponentWithProperties(SelectOrganizationTagsView, {
                organization: props.organization,
            }),
        ],
    });
}

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
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    deleting.value = false;
}

</script>

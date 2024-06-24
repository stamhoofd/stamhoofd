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

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('shared.address') }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        {{ organization.address }}
                    </p>
                    <p v-if="organization.meta.companyAddress && organization.meta.companyAddress != organization.address" class="style-description-small">
                        {{ $t('shared.invoiceAddress') }}: {{ organization.meta.companyAddress }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('shared.invoiceDetails') }}
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
                        {{ $t('shared.website') }}
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

                <STListItem :selectable="true" @click="editTags">
                    <h3 class="style-definition-label">
                        Tags
                    </h3>
                    <p class="style-definition-text" :class="{placeholder: tagStringList.length === 0}">
                        {{ tagStringList || 'Geen tags' }}
                    </p>

                    <template #right>
                        <span class="icon edit gray" />
                    </template>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Aantal leden
                    </h3>
                    <p v-copyable class="style-definition-text">
                        <MemberCountSpan :organization="organization" />
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
                        {{ $t('admin.organizations.settings.description') }}
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
                        {{ $t('admin.organizations.actions.members.description') }}
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
                        {{ $t('admin.organizations.login.description') }}
                    </p>
                    <template #right>
                        <span class="icon external gray" />
                    </template>
                </STListItem>
            </STList>

            <hr>
            <h2>
                {{ $t('admin.organizations.actions.delete.title') }}
            </h2>

            <LoadingButton :loading="deleting">
                <button class="button secundary danger" type="button" @click="deleteMe">
                    <span class="icon trash" />
                    <span>{{ $t('shared.delete') }}</span>
                </button>
            </LoadingButton>
        </main>
    </div>
</template>


<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Toast, useAuth, useContext, useKeyUpDown, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { computed, getCurrentInstance, ref } from 'vue';
import MemberCountSpan from './components/MemberCountSpan.vue';
import SelectOrganizationTagsView from './tags/SelectOrganizationTagsView.vue';
import EditOrganizationView from './EditOrganizationView.vue';
import { save } from 'pdfkit';

const props = defineProps<{
    organization: Organization,
    getNext: (current: Organization) => Organization | null,
    getPrevious: (current: Organization) => Organization | null,
}>();

const show = useShow();
const isPlatform = STAMHOOFD.userMode === 'platform'
const $t = useTranslate();
const context = useContext();
const owner = useRequestOwner()
const pop = usePop();
const platform = usePlatform();
const present = usePresent();

useKeyUpDown({
    up: goBack,
    down: goNext
});

const title = computed(() => {
    return props.organization.name;
});

const hasPrevious = computed(() => {
    if (!props.getPrevious) {
        return false
    }
    return !!props.getPrevious(props.organization);
});

const hasNext = computed(() => {
    if (!props.getNext) {
        return false
    }
    return !!props.getNext(props.organization);
});

const tagStringList = computed(() => {
    return props.organization.meta.tags.map(id => platform.value.config.tags.find(t => t.id === id)?.name ?? 'onbekend').join(', ');
});

const instance = getCurrentInstance();
const auth = useAuth();

async function seek(previous = true) {
    const organization = previous ? props.getPrevious(props.organization) : props.getNext(props.organization)
    if (!organization) {
        return;
    }
    const component = new ComponentWithProperties(instance!.type, {
        ...props,
        organization
    });

    await show({
        components: [component],
        replace: 1,
        reverse: previous,
        animated: false
    })
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
                organization: props.organization
            })
        ]
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
                        decoder: Organization as Decoder<Organization>
                    });

                    props.organization.set(response.data)
                }
            })
        ]
    });
}

async function deleteMe() {
    if (deleting.value) {
        return;
    }
    deleting.value = true;

    if (!await CenteredMessage.confirm($t('admin.organizations.deleteConfirmation.title'), $t('shared.confirmDelete'), $t('admin.organizations.deleteConfirmation.description'))) {
        deleting.value = false;
        return;
    }

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Second confirmation window

    if (!await CenteredMessage.confirm($t('admin.organizations.deleteConfirmation2.title'), $t('shared.confirmDelete'), $t('admin.organizations.deleteConfirmation.description'))) {
        deleting.value = false;
        return;
    }

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (!await CenteredMessage.confirm($t('admin.organizations.deleteConfirmation3.title'), $t('shared.confirmDelete'), $t('admin.organizations.deleteConfirmation.description'))) {
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
            owner
        });
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    }

    deleting.value = false;
}

</script>

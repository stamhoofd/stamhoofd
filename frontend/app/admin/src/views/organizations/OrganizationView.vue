<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
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
                        Adres
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.address }}
                    </p>
                    <p v-if="organization.meta.companyAddress && organization.meta.companyAddress != organization.address" class="style-description-small">
                        Facturatieadres: {{ organization.meta.companyAddress }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Facturatiegegevens
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.meta.companyName || organization.name }}
                    </p>
                    <p v-if="organization.meta.companyAddress" class="style-description-small">
                        {{ organization.meta.companyAddress }}
                    </p>
                    <p class="style-description-small">
                        {{ organization.meta.VATNumber || organization.meta.companyNumber || 'Geen ondernemingsnummer' }}
                    </p>
                </STListItem>

                <STListItem v-if="organization.website" element-name="a" :href="organization.website" :selectable="true" target="_blank">
                    <h3 class="style-definition-label">
                        Website
                    </h3>
                    <p class="style-definition-text">
                        {{ organization.website }}
                    </p>

                    <template #right>
                        <button class="button icon external" type="button"/>
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

                <STListItem>
                    <h3 class="style-definition-label">
                        Aantal leden
                    </h3>
                    <p class="style-definition-text">
                        <MemberCountSpan :organization="organization" />
                    </p>
                </STListItem>
            </STList>

            <hr>

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
        </main>
    </div>
</template>


<script lang="ts" setup>
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { useKeyUpDown } from '@stamhoofd/components';
import { Organization } from '@stamhoofd/structures';
import { computed, getCurrentInstance } from 'vue';
import MemberCountSpan from './components/MemberCountSpan.vue';

const props = defineProps<{
    organization: Organization,
    getNext: (current: Organization) => Organization | null,
    getPrevious: (current: Organization) => Organization | null,
}>();

const show = useShow();
const isPlatform = STAMHOOFD.userMode === 'platform'

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

const instance = getCurrentInstance()
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

</script>

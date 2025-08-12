<template>
    <div class="st-view search-organization-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>
            <STErrorsDefault :error-box="errors.errorBox" />

            <form class="search-box input-icon-container icon search gray" @submit.prevent>
                <input ref="input" v-model="name" :autofocus="true" class="input" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t('Zoek op naam')">
            </form>

            <Spinner v-if="loadingResults || (loadingAfterOrganizerSelect && !selectedOrganizerId)" class="gray center" />
            <STList v-else>
                <STListItem v-for="organizer in results" :key="organizer.id" :selectable="true" @click="doSelectOrganizer(organizer)">
                    <h2>{{ organizer.name }}</h2>
                    <template #right>
                        <Spinner v-if="loadingAfterOrganizerSelect && (organizer.id === selectedOrganizerId)" class="gray center" />
                        <span v-else class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-if="!loadingResults && results.length === 0 && name" class="info-box">
                {{ $t('Geen organisatoren gevonden.') }}
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ErrorBox, NavigationActions, Spinner, Toast, useContext, useErrors, useNavigationActions } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { UitpasOrganizerResponse, UitpasOrganizersResponse } from '@stamhoofd/structures';
import { throttle } from '@stamhoofd/utility';
import { Ref, ref, watch } from 'vue';

const props = withDefaults(
    defineProps<{
        title?: string;
        selectOrganizer: (uitpasOrganizerResponse: UitpasOrganizerResponse, navigation: NavigationActions) => Promise<void> | void;
    }>(), {
        title: () => $t('UiTPAS-organisator zoeken'),
    },
);

const context = useContext();
const navigationActions = useNavigationActions();
const loadingResults = ref(false);
const name = ref('');
const results = ref([]) as Ref<UitpasOrganizerResponse[]>;
const owner = useRequestOwner();
const errors = useErrors();

let lastName = '';
let counter = 0;

const loadingAfterOrganizerSelect = ref(false);
const selectedOrganizerId = ref('');

const updateResults = async () => {
    const n = name.value;
    const cachedCount = counter;

    if (n.length === 0) {
        results.value = [];
        loadingResults.value = false;
        return;
    }
    loadingResults.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/search-uitpas-organizers',
            query: { name: n },
            decoder: UitpasOrganizersResponse as Decoder<UitpasOrganizersResponse>,
            owner,
        });

        if (cachedCount !== counter) {
            // A new request have started already
            return;
        }
        results.value = response.data.member;
    }
    catch (e) {
        if (cachedCount !== counter) {
            // A new request have started already
            return;
        }
        if (!Request.isAbortError(e)) {
            console.error(e);
            Toast.fromError(e).show();
        }
        results.value = [];
    }

    if (cachedCount !== counter) {
        // A new request have started already
        return;
    }
    loadingResults.value = false;
};

const throttleUpdateResults = throttle(updateResults, 500);

const startUpdateResults = async () => {
    const value = name.value;
    if (value === lastName) {
        return;
    }
    lastName = value;
    loadingResults.value = true;
    counter += 1;

    Request.cancelAll(owner);

    if (value.length === 0) {
        results.value = [];
        loadingResults.value = false;
        return;
    }
    throttleUpdateResults();
};

watch(name, startUpdateResults);

async function doSelectOrganizer(organizer: UitpasOrganizerResponse) {
    errors.errorBox = null;
    loadingAfterOrganizerSelect.value = true;
    selectedOrganizerId.value = organizer.id;
    try {
        await props.selectOrganizer(organizer, navigationActions);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loadingAfterOrganizerSelect.value = false;
    }
}

</script>

<style lang="scss">
.search-organization-view {
    .search-box {
        margin: 15px 0;
    }
}
</style>

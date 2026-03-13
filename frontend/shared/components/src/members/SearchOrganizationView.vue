<template>
    <div class="st-view search-organization-view">
        <STNavigationBar :title="$t('%KC')" />

        <main>
            <h1>{{ title }}</h1>
            <p v-if="description" class="style-description-block pre-wrap" v-text="description" />
            <STErrorsDefault :error-box="errors.errorBox" />

            <form class="search-box input-icon-container icon search gray" @submit.prevent>
                <input ref="input" v-model="query" :autofocus="true" class="input" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%3u`)" data-testid="organization-search-input">
            </form>

            <Spinner v-if="loadingResults" class="gray center" />
            <STList v-else>
                <STListItem v-for="organization in results" :key="organization.id" :selectable="true" data-testid="organization-button" @click="doSelectOrganization(organization)">
                    <template #left>
                        <OrganizationAvatar :organization="organization" />
                    </template>

                    <h2>{{ organization.name }}</h2>

                    <p class="style-description">
                        {{ organization.address.anonymousString(defaultCountry) }}
                    </p>
                </STListItem>
            </STList>
            <p v-if="!loadingResults && results.length === 0 && query" class="info-box">
                {{ $t('%5H') }}
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ErrorBox } from '#errors/ErrorBox.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';
import OrganizationAvatar from '#context/OrganizationAvatar.vue';
import Spinner from '#Spinner.vue';
import { Toast } from '#overlays/Toast.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { Organization } from '@stamhoofd/structures';
import { throttle } from '@stamhoofd/utility';
import { Ref, ref, watch } from 'vue';

const props = withDefaults(
    defineProps<{
        title?: string;
        description?: string;
        selectOrganization: (organization: Organization, navigation: NavigationActions) => Promise<void> | void;
    }>(), {
        title: () => $t(`%KC`),
        description: '',
    },
);

const navigationActions = useNavigationActions();
const loadingResults = ref(false);
const query = ref('');
const results = ref([]) as Ref<Organization[]>;
const owner = useRequestOwner();
const defaultCountry = I18nController.shared.countryCode;
const errors = useErrors();

let lastQuery = '';
let counter = 0;

const updateResults = async () => {
    const q = query.value;
    const cachedCount = counter;

    if (q.length === 0) {
        results.value = [];
        loadingResults.value = false;
        return;
    }
    loadingResults.value = true;

    try {
        const response = await NetworkManager.server.request({
            method: 'GET',
            path: '/organizations/search',
            query: { query: q },
            decoder: new ArrayDecoder(Organization as Decoder<Organization>),
            owner,
        });

        if (cachedCount !== counter) {
            // A new request have started already
            return;
        }
        results.value = response.data;
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
    const value = query.value;
    if (value === lastQuery) {
        return;
    }
    lastQuery = value;
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

watch(query, startUpdateResults);

async function doSelectOrganization(organization: Organization) {
    try {
        errors.errorBox = null;
        await props.selectOrganization(organization, navigationActions);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
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

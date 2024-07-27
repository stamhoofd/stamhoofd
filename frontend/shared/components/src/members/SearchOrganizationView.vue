<template>
    <div class="st-view search-organization-view">
        <STNavigationBar :title="$t('Zoeken')" />

        <main>
            <h1>{{ title }}</h1>
            <p v-if="description" class="style-description-block pre-wrap" v-text="description" />

            <form class="search-box input-icon-container icon search gray" @submit.prevent>
                <input ref="input" v-model="query" :autofocus="true" class="input" placeholder="Zoek op naam of postcode" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
            </form>

            <Spinner v-if="loadingResults" class="gray center" />
            <STList v-else>
                <STListItem v-for="organization in results" :key="organization.id" :selectable="true" @click="selectOrganization(organization, navigationActions)">
                    <template #left>
                        <OrganizationAvatar :organization="organization" />
                    </template>

                    <h2>{{ organization.name }}</h2>

                    <p class="style-description">
                        {{ organization.address.anonymousString(defaultCountry) }}
                    </p>
                </STListItem>
            </STList>
            <p v-if="!loadingResults && results.length == 0 && query" class="info-box">
                {{ $t('shared.searchMemberOrganizations.empty') }}
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { usePop } from '@simonbackx/vue-app-navigation';
import { NavigationActions, OrganizationAvatar, Spinner, Toast, useNavigationActions } from '@stamhoofd/components';
import { I18nController, useTranslate } from '@stamhoofd/frontend-i18n';
import { NetworkManager, useRequestOwner } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { throttle } from "@stamhoofd/utility";
import { Ref, ref, watch } from 'vue';

withDefaults(
    defineProps<{
        title?: string
        description?: string,
        selectOrganization: (organization: Organization, navigation: NavigationActions) => Promise<void>|void;
    }>(), {
        title: 'Zoeken',
        description: '',
    }
);

const navigationActions = useNavigationActions()
const loadingResults = ref(false)
const query = ref("");
const results = ref([]) as Ref<Organization[]>;
const owner = useRequestOwner()
const defaultCountry = I18nController.shared.country
const pop = usePop()
const $t = useTranslate();

let lastQuery = '';
let counter = 0;

const updateResults = async () => {
    const q = query.value
    const cachedCount = counter

    if (q.length == 0 ) {
        results.value = []
        loadingResults.value = false
        return
    }
    loadingResults.value = true

    try {
        const response = await NetworkManager.server.request({
            method: "GET",
            path: "/organizations/search",
            query: {query: q },
            decoder: new ArrayDecoder(Organization as Decoder<Organization>),
            owner
        })

        if (cachedCount !== counter) {
            // A new request have started already
            return
        }
        results.value = response.data
    } catch (e) {
        if (cachedCount !== counter) {
            // A new request have started already
            return
        }
        if (!Request.isAbortError(e)) {
            console.error(e)
            Toast.fromError(e).show()
        }
        results.value = []
    }

    if (cachedCount !== counter) {
        // A new request have started already
        return
    }
    loadingResults.value = false
}

const throttleUpdateResults = throttle(updateResults, 500);

const startUpdateResults = async () => {
    const value = query.value
    if (value === lastQuery) {
        return
    }
    lastQuery = value
    loadingResults.value = true
    counter += 1;

    Request.cancelAll(owner)

    if (value.length == 0) {
        results.value = []
        loadingResults.value = false
        return
    }
    throttleUpdateResults()
}

watch(query, startUpdateResults);

</script>

<style lang="scss">
.search-organization-view {
    .search-box {
        margin: 15px 0;
    }
}
</style>

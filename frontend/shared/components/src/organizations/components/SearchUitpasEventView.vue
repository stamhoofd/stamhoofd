<template>
    <div class="st-view search-uitpas-event-view">
        <STNavigationBar :title="t" />

        <main>
            <h1>{{ t }}</h1>
            <p class="style-description-small">
                {{ $t('Door een evenement uit de UiTdatabank te koppelen kan #platform een verkoop met kansentarief registreren bij jouw UiTPAS-regio. Je krijgt dan automatisch een (gedeeltelijke) terugbetaling en jouw regio bepaalt het kansentarief.') }}
            </p>
            <p v-if="showNoteAboutNonOfficialFlow" class="style-description-small">
                <I18nComponent :t="$t('Wil je de UiTPAS-nummers niet doorsturen en zelf het tarief instellen, <button>klik dan hier</button>.')">
                    <template #button="{content}">
                        <button class="inline-link" type="button" @click="doSelectEvent(null)">
                            {{ content }}
                        </button>
                    </template>
                </I18nComponent>
            </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <form class="search-box input-icon-container icon search gray" @submit.prevent>
                <input ref="input" v-model="text" :autofocus="true" class="input" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t('Zoek op naam, locatie, beschrijving, ...')">
            </form>

            <Spinner v-if="loadingResults || (loadingAfterEventSelect && !selectedEventUrl)" class="gray center" />
            <STList v-else>
                <STListItem v-for="event in results" :key="event.url" :selectable="true" @click="doSelectEvent(event)">
                    <template #left>
                        <DateBox :date="event.startDate ?? event.endDate ?? undefined" />
                    </template>
                    <h2>{{ event.name }}</h2>
                    <p class="style-description-small">
                        <span class="style-description-small">{{ event.location }}</span>
                    </p>
                    <template #right>
                        <Spinner v-if="loadingAfterEventSelect && (event.url === selectedEventUrl)" class="gray center" />
                        <span v-else class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-if="!loadingResults && results.length === 0 && text" class="info-box">
                {{ $t('Geen evenementen gevonden.') }}
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ErrorBox, NavigationActions, Spinner, Toast, useContext, useErrors, useNavigationActions, DateBox } from '@stamhoofd/components';
import { UitpasEventResponse, UitpasEventsResponse } from '@stamhoofd/structures';
import { useRequestOwner } from '@stamhoofd/networking';
import { throttle } from '@stamhoofd/utility';
import { Ref, ref, watch } from 'vue';
import { I18nComponent } from '@stamhoofd/frontend-i18n';

const props = withDefaults(
    defineProps<{
        title?: string;
        selectEvent: (UitpasEventResponse: UitpasEventResponse | null, navigation: NavigationActions) => Promise<void> | void;
        showNoteAboutNonOfficialFlow?: boolean;
    }>(), {
        title: $t('UiTPAS-evenement zoeken'),
        showNoteAboutNonOfficialFlow: true,
    },
);

const context = useContext();
const navigationActions = useNavigationActions();
const loadingResults = ref(false);
const text = ref('');
const results = ref([]) as Ref<UitpasEventResponse[]>;
const owner = useRequestOwner();
const errors = useErrors();
const t = props.title;

let lastText = '';
let counter = 0;

const loadingAfterEventSelect = ref(false);
const selectedEventUrl = ref('');

const updateResults = async () => {
    const t = text.value;
    const cachedCount = counter;

    if (t.length === 0) {
        results.value = [];
        loadingResults.value = false;
        return;
    }
    loadingResults.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/search-uitpas-events',
            query: { text: t },
            decoder: UitpasEventsResponse as Decoder<UitpasEventsResponse>,
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
    const value = text.value;
    if (value === lastText) {
        return;
    }
    lastText = value;
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

watch(text, startUpdateResults);

async function doSelectEvent(event: UitpasEventResponse | null) {
    try {
        errors.errorBox = null;
        selectedEventUrl.value = event?.url ?? '';
        loadingAfterEventSelect.value = true;
        await props.selectEvent(event, navigationActions);
        loadingAfterEventSelect.value = false;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>

<style lang="scss">
.search-uitpas-event-view {
    .search-box {
        margin: 15px 0;
    }
}
</style>

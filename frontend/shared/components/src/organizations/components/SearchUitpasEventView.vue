<template>
    <div class="st-view search-uitpas-event-view">
        <STNavigationBar :title="t" />

        <main>
            <h1>{{ t }}</h1>
            <p class="style-description-small">
                {{ $t('%1CV') }}
            </p>
            <p v-if="showNoteAboutNonOfficialFlow" class="style-description-small">
                <I18nComponent :t="$t('%1CW')">
                    <template #button="{content}">
                        <button class="inline-link" type="button" @click="doSelectEvent(null)">
                            {{ content }}
                        </button>
                    </template>
                </I18nComponent>
            </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <form class="search-box input-icon-container icon search gray" @submit.prevent>
                <input ref="input" v-model="text" :autofocus="true" class="input" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t('%1CX')">
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
                {{ $t('%1CY') }}
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ErrorBox } from '#errors/ErrorBox.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';
import Spinner from '#Spinner.vue';
import { Toast } from '#overlays/Toast.ts';
import { useContext } from '#hooks/useContext.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import DateBox from '#icons/DateBox.vue';
import type { UitpasEventResponse} from '@stamhoofd/structures';
import { UitpasEventsResponse } from '@stamhoofd/structures';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { throttle } from '@stamhoofd/utility';
import type { Ref} from 'vue';
import { ref, watch } from 'vue';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';

const props = withDefaults(
    defineProps<{
        title?: string;
        selectEvent: (UitpasEventResponse: UitpasEventResponse | null, navigation: NavigationActions) => Promise<void> | void;
        showNoteAboutNonOfficialFlow?: boolean;
    }>(), {
        title: $t('%1CZ'),
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
    errors.errorBox = null;
    selectedEventUrl.value = event?.url ?? '';
    loadingAfterEventSelect.value = true;
    try {
        await props.selectEvent(event, navigationActions);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loadingAfterEventSelect.value = false;
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

<template>
    <LoadingViewTransition :loading="loading">
        <SaveView :title="$t('%ZvC')" :loading="saving" :disabled="!selectedId" data-testid="mailchimp-audience-view" @save="save">
            <h1>{{ $t('%Zx2') }}</h1>
            <p>{{ $t('%Zu5') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="!loading && audiences.length === 0" class="info-box">
                {{ $t('%Zvs') }}
            </p>

            <STList>
                <STListItem v-for="audience of audiences" :key="audience.id" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="selectedId" :value="audience.id" />
                    </template>
                    <h3 class="style-title-list">
                        {{ audience.name }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%ZuQ', { count: audience.memberCount.toString() }) }}
                    </p>
                </STListItem>
            </STList>
        </SaveView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { usePop } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { MailchimpAudience } from '@stamhoofd/structures/mailchimp/MailchimpAudience.js';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { onMounted, ref } from 'vue';
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import Radio from '#inputs/Radio.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import SaveView from '#navigation/SaveView.vue';
import { useMailchimpSettings } from './useMailchimp.ts';

const pop = usePop();
const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const { settings, setSettings } = useMailchimpSettings();

const loading = ref(true);
const saving = ref(false);
const audiences = ref<MailchimpAudience[]>([]);
const selectedId = ref<string | null>(settings.value?.audienceId ?? null);

onMounted(async () => {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/mailchimp/audiences',
            decoder: new ArrayDecoder(MailchimpAudience as Decoder<MailchimpAudience>),
            owner,
        });
        audiences.value = response.data;
        if (!selectedId.value && audiences.value.length === 1) {
            selectedId.value = audiences.value[0].id;
        }
    }
    catch (e) {
        if (!Request.isAbortError(e)) {
            errors.errorBox = new ErrorBox(e);
        }
    }
    loading.value = false;
});

async function save() {
    if (saving.value || !selectedId.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/mailchimp/settings',
            body: MailchimpSettings.patch({ audienceId: selectedId.value }),
            decoder: MailchimpSettings as Decoder<MailchimpSettings>,
            owner,
            shouldRetry: false,
        });
        setSettings(response.data);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}
</script>

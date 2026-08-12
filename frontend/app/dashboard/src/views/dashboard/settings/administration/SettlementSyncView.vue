<template>
    <SaveView :loading="saving" :title="$t('%Zjz')" :save-text="$t('%Vm')" @save="save">
        <h1>
            {{ $t('%Zjz') }}
        </h1>
        <p>{{ $t('%Zk3') }}</p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox error-fields="startDate" :error-box="errorBox" :title="$t('%5M')">
            <DateSelection v-model="startDate" />
        </STInputBox>

        <hr><h2>{{ $t('%P1') }}</h2>
        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="force" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%ZkF') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%Zjw') }}
                </p>
            </STListItem>
        </STList>

        <div v-if="runningJobs.length" class="container">
            <hr><h2>{{ $t('%Zc2') }}</h2>
            <STList>
                <STListItem v-for="(runningJob, index) in runningJobs" :key="index">
                    <h3 class="style-title-list">
                        {{ $t('%ZkD', {start: formatDateTime(runningJob.start)}) }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%Zjy', {count: runningJob.count.toString(), failed: runningJob.failed.toString()}) }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { SettlementsSyncStatus } from '@stamhoofd/structures/settlements/SettlementsSyncStatus.js';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Formatter } from '@stamhoofd/utility';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

const context = useContext();
const pop = usePop();
const requestOwner = {};
const errorBox = ref<ErrorBox | null>(null);
const saving = ref(false);
// Where the stored settlement history starts, the same default as the endpoint
const startDate = ref(new Date(2025, 0, 1));
const force = ref(false);
const runningJobs = shallowRef<SettlementsSyncStatus[]>([]);
let loadingJobs = false;
let interval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
    loadJobs().catch(console.error);
    interval = setInterval(() => {
        loadJobs().catch(console.error);
    }, 1000);
});

onBeforeUnmount(() => {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    Request.cancelAll(requestOwner);
});

function formatDateTime(date: Date) {
    return Formatter.dateTime(date);
}

async function loadJobs() {
    if (loadingJobs) {
        return;
    }
    loadingJobs = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/settlements/sync/status',
            decoder: new ArrayDecoder(SettlementsSyncStatus as Decoder<SettlementsSyncStatus>),
            shouldRetry: false,
            owner: requestOwner,
        });
        runningJobs.value = response.data;
    } catch (e) {
        if (!Request.isAbortError(e)) {
            console.error(e);
        }
    }
    loadingJobs = false;
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/settlements/sync',
            body: {
                start: startDate.value.getTime(),
                force: force.value,
            },
            owner: requestOwner,
        });
        new Toast($t('%ZkG'), 'success').show();
        await pop({ force: true });
    } catch (e) {
        errorBox.value = new ErrorBox(e as Error);
    }
    saving.value = false;
}
</script>

<template>
    <div class="st-view preview-record-view">
        <STNavigationBar :title="$t(`%ID`)" />

        <main>
            <h1>
                {{ $t('%jH') }}
            </h1>
            <p>{{ $t('%jI') }}</p>

            <hr><RecordAnswerInput :record="record" :answers="recordAnswers" :validator="validator" @patch="addPatch" />

            <div v-if="isDevelopment" class="container">
                <hr><p class="style-description pre-wrap" v-text="encodedResult" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="dismiss()">
                    {{ $t('%9b') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { encodeObject } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import RecordAnswerInput from '#inputs/RecordAnswerInput.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { Validator } from '#errors/Validator.ts';
import type { PatchAnswers, RecordAnswer, RecordSettings } from '@stamhoofd/structures';
import { Version } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

defineProps<{
    record: RecordSettings;
}>();

const dismiss = useDismiss();
const validator = new Validator();
const recordAnswers = ref<Map<string, RecordAnswer>>(new Map());
const encodedResult = computed(() => encodeObject(recordAnswers.value, { version: Version }));
const isDevelopment = STAMHOOFD.environment === 'development';

function addPatch(patch: PatchAnswers) {
    recordAnswers.value = patch.applyTo(recordAnswers.value);
}
</script>

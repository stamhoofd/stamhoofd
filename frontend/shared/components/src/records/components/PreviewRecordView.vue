<template>
    <div class="st-view preview-record-view">
        <STNavigationBar :title="$t(`38e2c1aa-13f6-4339-8cfd-68c2603beb51`)" />

        <main>
            <h1>
                {{ $t('0e35cf4e-81ea-41f3-973e-d7b9421363dc') }}
            </h1>
            <p>{{ $t('8ea4aba7-c146-4935-9117-7e66a35ef6c8') }}</p>

            <hr><RecordAnswerInput :record="record" :answers="recordAnswers" :validator="validator" @patch="addPatch" />

            <div v-if="isDevelopment" class="container">
                <hr><p class="style-description pre-wrap" v-text="encodedResult" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="dismiss">
                    {{ $t('bef7a2f9-129a-4e1c-b8d2-9003ff0a1f8b') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { encodeObject } from '@simonbackx/simple-encoding';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { RecordAnswerInput, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from '@stamhoofd/components';
import { PatchAnswers, RecordAnswer, RecordSettings, Version } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Spinner,
        STList,
        STListItem,
        RecordAnswerInput,
    },
})
export default class PreviewRecordView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    record!: RecordSettings;

    validator = new Validator();

    recordAnswers: Map<string, RecordAnswer> = new Map();

    get encodedResult() {
        return encodeObject(this.recordAnswers, { version: Version });
    }

    get isDevelopment() {
        return STAMHOOFD.environment === 'development';
    }

    addPatch(patch: PatchAnswers) {
        this.recordAnswers = patch.applyTo(this.recordAnswers);
    }
}
</script>

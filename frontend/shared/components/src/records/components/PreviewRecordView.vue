<template>
    <div class="st-view preview-record-view">
        <STNavigationBar title="Voorbeeld" />

        <main>
            <h1>
                Voorbeeld bekijken
            </h1>
            <p>Hieronder zie je hoe het formulier van de vraag/kenmerk eruit ziet.</p>

            <hr>
        
            <RecordAnswerInput :record="record" :answers="recordAnswers" :validator="validator" @patch="addPatch" />

            <div v-if="isDevelopment" class="container">
                <hr>
                <p class="style-description pre-wrap" v-text="encodedResult" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="dismiss">
                    Sluiten
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { encodeObject } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { RecordAnswerInput, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { PatchAnswers, RecordAnswer, RecordSettings, Version } from "@stamhoofd/structures";


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Spinner,
        STList,
        STListItem,
        RecordAnswerInput
    },
})
export default class PreviewRecordView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        record!: RecordSettings

    validator = new Validator()

    recordAnswers: Map<string, RecordAnswer> = new Map()

    get encodedResult() {
        return encodeObject(this.recordAnswers, { version: Version })
    }

    get isDevelopment() {
        return STAMHOOFD.environment === "development"
    }

    addPatch(patch: PatchAnswers) {
        this.recordAnswers = patch.applyTo(this.recordAnswers)
    }
}
</script>

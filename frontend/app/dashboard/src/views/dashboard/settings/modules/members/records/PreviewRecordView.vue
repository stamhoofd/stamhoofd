<template>
    <div class="st-view preview-record-view">
        <STNavigationBar title="Voorbeeld">
            <template slot="right">
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                Voorbeeld bekijken
            </h1>
            <p>Hieronder zie je hoe het formulier van de vraag/kenmerk eruit ziet.</p>

            <hr>
        
            <RecordAnswerInput :record-settings="record" :record-answers="recordAnswers" />

            <div v-if="isDevelopment" class="container">
                <hr>
                <p class="style-description pre-wrap" v-text="encodedResult" />
            </div>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="dismiss">
                    Sluiten
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { encodeObject } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { RecordAnswerInput,Spinner,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { RecordAnswer, RecordSettings, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";


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

    recordAnswers: RecordAnswer[] = []

    get encodedResult() {
        return encodeObject(this.recordAnswers, { version: Version })
    }

    get isDevelopment() {
        return STAMHOOFD.environment === "development"
    }
}
</script>
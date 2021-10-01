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
        
            <RecordAnswerInput :record-settings="record" :record-answers="recordAnswers" />
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { RecordAnswerInput,Spinner,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { RecordSettings } from "@stamhoofd/structures"
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

    recordAnswers = []
}
</script>
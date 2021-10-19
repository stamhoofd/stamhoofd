<template>
    <dl class="details-grid">
        <template v-for="record of records">
            <dt :key="'dt-'+record.id" class="center">
                {{ record.name }}
            </dt>
            <dd v-if="!getAnswer(record)" :key="'dd-'+record.id">
                /
            </dd>
            <template v-else-if="getAnswer(record).settings.type === RecordType.Checkbox">
                <dd :key="'dd-'+record.id" class="center icons">
                    <span v-if="getAnswer(record).selected" class="icon success primary" />
                    <span v-else class="icon canceled gray" />
                    <button v-if="canDelete" class="button icon trash" type="button" @click="$emit('delete', record)" />
                </dd>
                <dd v-if="getAnswer(record).comments" :key="'dd-description-'+record.id" class="description pre-wrap" v-text="getAnswer(record).comments" />
            </template>
            <dd v-else :key="'dd-'+record.id">
                {{ getAnswer(record).stringValue }}

                <button v-if="canDelete" class="button icon trash" type="button" @click="$emit('delete', record)" />
            </dd>
        </template>
    </dl>
</template>



<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { RecordAnswer, RecordCategory, RecordSettings, RecordType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
    },
    filters: {
        price: Formatter.price
    }
})
export default class RecordCategoryAnswersBox extends Mixins(NavigationMixin){
    @Prop({ required: true })
    answers: RecordAnswer[]

    @Prop({ required: false })
    category?: RecordCategory

    @Prop({ required: true })
    dataPermission!: boolean

    @Prop({ default: false })
    canDelete!: boolean

    get records() {
        if (!this.category) {
            return this.answers.map(a => a.settings)
        }
        return this.category.filterRecords(this.dataPermission)
    }

    get RecordType() {
        return RecordType
    }

    getAnswer(record: RecordSettings) {
        return this.answers.find(a => a.settings.id === record.id)
    }
}
</script>
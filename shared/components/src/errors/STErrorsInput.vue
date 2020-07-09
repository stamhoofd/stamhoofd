<template>
    <div ref="errors" :class="{'input-errors': errors.length > 0}">
        <slot />
        <div>
            <template v-for="error in errors">
                <STErrorBox :key="error.id">
                    {{ error.human || error.message }}
                </STErrorBox>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import { ErrorBox } from "./ErrorBox"
import STErrorBox from "./STErrorBox.vue"

@Component({
    components: {
        STErrorBox
    }
})
export default class STErrorsDefault extends Vue {
    @Prop({ default: "" }) errorFields: string;
    @Prop({ default: null }) errorBox: ErrorBox | null;
    errors: SimpleError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        if (!val) {
            this.errors = [];
            return;
        }
        console.log("Picked new errors for", this.errorFields);
        const errors = val.forFields(this.errorFields.split(","))
        this.errors = errors.errors
        val.scrollTo(this.errors, this.$refs.errors as HTMLElement)
    }
}
</script>
<template>
    <div :class="{'input-errors': errors.length > 0}">
        <slot />
        <div ref="errors" style="min-height: 1px;">
            <template v-for="error in errors">
                <ErrorBox :key="error.message">
                    {{ error.human || error.message }}
                </ErrorBox>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import { STError } from '@stamhoofd-common/errors';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import { ErrorBox } from "./ErrorBox"
import ErrorBoxComponent from "./ErrorBox.vue"

@Component({
    components: {
        ErrorBox: ErrorBoxComponent
    }
})
export default class STErrorsDefault extends Vue {
    @Prop() errorFields: string;
    @Prop() errorBox: ErrorBox;
    errors: STError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        console.log("Picked new errors for", this.errorFields);
        const errors = val.forFields(this.errorFields.split(","))
        this.errors = errors.errors

        if (this.errors.length > 0) {
            val.scrollTo(this.$refs.errors as HTMLElement)
        }
    }
}
</script>
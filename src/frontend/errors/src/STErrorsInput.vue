<template>
    <div :class="{'input-errors': errors.length > 0}">
        <slot />
        <div v-for="(error, index) in errors" :key="index" class="error">
            {{ error.human || error.message }}
        </div>
    </div>
</template>

<script lang="ts">
import { ClientError } from '@stamhoofd-backend/routing/src/ClientError';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import { ErrorBox } from "./ErrorBox"

@Component({})
export default class STErrorsDefault extends Vue {
    @Prop() errorFields: string;
    @Prop() errorBox: ErrorBox;
    errors: ClientError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        console.log("Picked new errors for", this.errorFields);
        const errors = val.forFields(this.errorFields.split(","))
        this.errors = errors.errors
    }
}
</script>

<style lang="scss">
    .error {
        color: red;
    }
</style>
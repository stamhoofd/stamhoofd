<template>
    <div>
        <div v-for="(error, index) in errors.errors" :key="index" class="error">
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
    @Prop() errorBox: ErrorBox | null;
    errors: ClientError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        console.log("Picked new default errors");
        const errors = val.remaining
        this.errors.push(...errors.errors)
    }
}
</script>

<style lang="scss">
    .error {
        color: red;
    }
</style>
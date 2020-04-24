<template>
    <div>
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
    @Prop() errorBox: ErrorBox | null;
    errors: ClientError[] = [];

    @Watch('errorBox')
    onNewErrors(val: ErrorBox) {
        const errors = val.remaining
        console.log("Picked new default errors", errors);

        this.errors = errors.errors
    }
}
</script>

<style lang="scss">
    .error {
        color: red;
    }
</style>
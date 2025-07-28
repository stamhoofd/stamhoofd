<template>
    <div>
        <div v-if="loading || delayLoading" class="input-wrapper">
            <input
                ref="ignore"
                class="input with-spinner"
                type="text"
                autocomplete="off"
                :placeholder="$t('Berekenen...')"
                :disabled="true"
            >
            <Spinner class="spinner-inside-input" />
        </div>
        <div v-else>
            <slot />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';
import Spinner from '../Spinner.vue';

@Component({
    components: { Spinner },
})
export default class LoadingInputWrapper extends VueComponent {
    @Prop({ default: false, type: Boolean })
    loading!: boolean;

    delayLoading = false;

    @Watch('loading')
    onLoadingChanged(val: boolean, oldVal: boolean) {
        if (!val && oldVal) {
            this.delayLoading = true;
            setTimeout(() => {
                this.delayLoading = false;
            }, 500);
        }
        else if (val) {
            this.delayLoading = true;
        }
    }
}
</script>

<style scoped>
.input-wrapper {
    position: relative;
    display: inline-block;
    width: 100%;
}

.input.with-spinner {
    padding-right: 2.5em; /* leave space for spinner */
}

.spinner-inside-input {
    position: absolute;
    right: 0.75em;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
}
</style>

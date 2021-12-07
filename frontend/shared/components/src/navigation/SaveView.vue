<template>
    <form class="st-view" @submit.prevent="$emit('save')">
        <STNavigationBar v-if="$isMobile" :title="title">
            <button slot="left" class="button text selected unbold" type="button" @click="$parent.pop">
                {{ cancelText }}
            </button>
            <LoadingButton slot="right" :loading="loading">
                <button class="button text selected hightlight" :disabled="disabled" @click="$emit('save')">
                    {{ saveText }}
                </button>
            </LoadingButton>
        </STNavigationBar>
        <STNavigationBar v-else :title="title">
            <BackButton v-if="$parent.canPop" slot="left" @click="$parent.pop" />
            <button v-else slot="right" class="button icon gray close" type="button" @click="$parent.pop" />
        </STNavigationBar>
        <main>
            <slot />
        </main>
        <STToolbar v-if="!$isMobile">
            <template #right>
                <button class="button secundary" type="button" @click="$parent.pop">
                    {{ cancelText }}
                </button>
                <LoadingButton :loading="loading">
                    <button class="button primary" :disabled="disabled" @click="$emit('save')">
                        {{ saveText }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>


<script lang="ts">
import { Component,Prop,Vue } from "vue-property-decorator";

import LoadingButton from "./LoadingButton.vue";
import STNavigationBar from "./STNavigationBar.vue";
import STToolbar from "./STToolbar.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        LoadingButton
    }
})
export default class SaveView extends Vue {
    @Prop({ default: false })
    loading!: boolean;

    @Prop({ default: true })
    disabled!: boolean;

    @Prop({ default: "" })
    title!: string;

    @Prop({ default: "Opslaan" })
    saveText!: string;

    @Prop({ default: "Annuleren" })
    cancelText!: string;

}
</script>
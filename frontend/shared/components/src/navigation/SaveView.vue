<template>
    <form class="st-view" @submit.prevent="$emit('save')">
        <STNavigationBar :title="title">
            <template #left v-if="$parent.canPop || ($isMobile || $isIOS || $isAndroid)">
                <BackButton v-if="$parent.canPop" @click="$parent.pop" />
                <button v-else-if="$isAndroid" class="button navigation icon close" type="button" @click="$parent.pop" />
                <button v-else class="button text selected unbold" type="button" @click="$parent.pop">
                    {{ cancelText }}
                </button>
            </template>

            <template v-if="!$isMobile && !$isIOS" #right><slot name="buttons" /></template>

            <template v-if="!preferLargeButton && ($isMobile || $isIOS || $isAndroid)" #right>
                <LoadingButton :loading="loading">
                    <button class="button navigation highlight" :disabled="disabled" type="submit">
                        {{ saveText }}
                    </button>
                </LoadingButton>
            </template>
            <template v-else-if="$parent.canDismiss && !$isAndroid && !$isMobile && !$isIOS" #right><button class="button navigation icon close" type="button" @click="$parent.dismiss" /></template>
        </STNavigationBar>
        <main>
            <slot />
        </main>
        <STToolbar v-if="preferLargeButton || (!$isMobile && !$isIOS && !$isAndroid)">
            <template #left>
                <slot name="left" />
            </template>
            <template #right>
                <slot name="toolbar" />
                <button v-if="!$slots.toolbar && addExtraCancel && ($parent.canPop || $parent.canDismiss) && cancelText !== null" class="button secundary" type="button" @click="$parent.pop">
                    {{ cancelText }}
                </button>
                <LoadingButton :loading="loading">
                    <button class="button primary" :disabled="disabled" type="submit">
                        <span v-if="saveIcon" class="icon " :class="saveIcon" />
                        <span>{{ saveText }}</span>
                        <span v-if="saveIconRight" class="icon " :class="saveIconRight" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
        <STButtonToolbar v-else-if="!!$slots.buttons || !!$slots.toolbar" class="sticky">
            <slot name="buttons" />
            <slot name="toolbar" />
        </STButtonToolbar>
    </form>
</template>


<script lang="ts">
import { Component,Prop,Vue } from "vue-property-decorator";

import BackButton from "./BackButton.vue";
import LoadingButton from "./LoadingButton.vue";
import STButtonToolbar from "./STButtonToolbar.vue";
import STNavigationBar from "./STNavigationBar.vue";
import STToolbar from "./STToolbar.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        LoadingButton,
        BackButton,
        STButtonToolbar
    }
})
export default class SaveView extends Vue {
    @Prop({ default: false })
    loading!: boolean;

    @Prop({ default: false })
    disabled!: boolean;

    @Prop({ default: "" })
    title!: string;

    @Prop({ default: "Opslaan" })
    saveText!: string;

    @Prop({ default: null })
    saveIcon!: string | null;

    @Prop({ default: null })
    saveIconRight!: string | null;

    @Prop({ default: "Annuleren" })
    cancelText!: string | null;

    @Prop({ default: false })
    preferLargeButton!: boolean; // Always use large buttons at the bottom on mobile

    @Prop({ default: false })
    addExtraCancel!: boolean; // Add a large cancel button at the bottom
}
</script>
<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" @save="save">
        <h1>{{ title }}</h1>
        <component :is="component" :validator="errors.validator" :member="cloned" />
    </SaveView>
</template>

<script setup lang="ts">
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { useDismiss, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { PlatformMember, Version } from '@stamhoofd/structures';
import { ComponentOptions, Ref, computed, ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { NavigationActions, usePlatformFamilyManager } from './PlatformFamilyManager';

const props = withDefaults(
    defineProps<{
        title: string
        saveText?: string,
        component: ComponentOptions,
        // do not change this
        member: Readonly<PlatformMember>,
        saveHandler: (navigate: NavigationActions) => Promise<void>|void
    }>(), {
        saveText: 'Opslaan'
    }
);

// We use a clone, so we don't propate the patches to the rest of the app until the save was successful
const cloned = ref<PlatformMember>(props.member.clone()) as Ref<PlatformMember>;
const show = useShow();
const present = usePresent();
const dismiss = useDismiss();
const pop = usePop();
const loading = ref(false);
const errors = useErrors()
const manager = usePlatformFamilyManager();

async function save() {
    if (loading.value) {
        return;
    }

    loading.value = true;

    try {
        if (!await errors.validator.validate()) {
            loading.value = false;
            return;
        }

        console.log("Saving member", cloned.value.family.members, cloned.value);
        await manager.save(cloned.value.family.members)

        // Copy over clone
        props.member.family.copyFromClone(cloned.value.family)
        await props.saveHandler({
            show, present, dismiss, pop
        });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

const hasChanges = computed(() => {
    return cloned.value.isNew || patchContainsChanges(cloned.value.patch, cloned.value.member, {version: Version})
})

async function shouldNavigateAway() {
    if (!hasChanges.value && !loading.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})

</script>

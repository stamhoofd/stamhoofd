<template>
    <SaveView :title="title" :loading="loading" :save-text="isDuplicate ? 'Doorgaan' : saveText" @save="save">
        <template v-if="isDuplicate">
            <h1>{{ $t('fb429eae-7cd9-4250-b5bd-8863ae5a56fb') }} {{ cloned.patchedMember.details.firstName }}</h1>
            <p>{{ cloned.patchedMember.details.firstName }} {{ $t('b5c43411-0097-48fe-a7a7-13128feef887') }}</p>

            <STErrorsDefault :error-box="errors.errorBox"/>

            <STInputBox error-fields="code" :error-box="errors.errorBox" class="max" :title="$t(`188afef4-7116-41b8-ab40-ccb879da1756`)">
                <CodeInput v-model="code" :code-length="16" :space-length="4" :numbers-only="false" @complete="save"/>
            </STInputBox>

            <hr><h2>{{ $t('135914ca-9806-4523-b998-2f9b69aa509f') }}</h2>

            <STList class="illustration-list">
                <STListItem class="left-center">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/communication.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('2df03d52-7009-405e-a88b-6ad6bcd0f5b0') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('f5229cc1-c908-4409-855a-1dba40371815') }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('d5bbc83f-5a72-47c4-8d7d-f4fbb348ff18') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('555ac347-3ce0-4b3d-ba4f-5aefb57c44de') }}
                    </p>
                </STListItem>
            </STList>
        </template>
        <component :is="component" v-else :validator="errors.validator" :parent-error-box="errors.errorBox" :member="cloned" :will-mark-reviewed="willMarkReviewed" v-bind="$attrs" :level="1"/>
    </SaveView>
</template>

<script setup lang="ts">
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { useDismiss, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { PlatformMember, Version } from '@stamhoofd/structures';
import { ComponentOptions, computed, Ref, ref } from 'vue';

import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { useAppContext } from '../context';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import CodeInput from '../inputs/CodeInput.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import { NavigationActions } from '../types/NavigationActions';
import { usePlatformFamilyManager } from './PlatformFamilyManager';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(
    defineProps<{
        title: string;
        saveText?: string;
        component: ComponentOptions;
        // do not change this
        member: PlatformMember;
        // Whether the member should be saved to the API
        doSave?: boolean;
        markReviewed?: string[];
        saveHandler?: ((navigate: NavigationActions) => Promise<void> | void) | null;
    }>(), {
        doSave: true,
        saveText: 'Opslaan',
        saveHandler: null,
        markReviewed: () => [],
    },
);

// We use a clone, so we don't propate the patches to the rest of the app until the save was successful
const cloned = ref(props.member.clone() as any) as Ref<PlatformMember>;
const show = useShow();
const present = usePresent();
const dismiss = useDismiss();
const pop = usePop();
const loading = ref(false);
const errors = useErrors();
const manager = usePlatformFamilyManager();
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const willMarkReviewed = !isAdmin;
const isDuplicate = ref(false);
const code = ref('');

function patchMemberWithReviewed(member: PlatformMember) {
    if (props.markReviewed.length && willMarkReviewed) {
        const times = member.patchedMember.details.reviewTimes.clone();

        for (const r of props.markReviewed) {
            times.markReviewed(r as any, new Date());
        }

        member.addDetailsPatch({
            reviewTimes: times,
        });
    }
}

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

        if (isDuplicate.value) {
            if (code.value.length !== 16) {
                errors.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_field',
                    message: 'Vul de beveiligingscode in',
                    field: 'code',
                }));
                loading.value = false;
                return;
            }

            // Set security code on member details - this allows the backend to go through with the request
            cloned.value.addDetailsPatch({
                securityCode: code.value,
            });
        }

        if (props.doSave) {
            // Extra clone for saving, so the view doesn't change during saving
            const saveClone = cloned.value.clone();
            patchMemberWithReviewed(saveClone);
            await manager.save(saveClone.family.members);
            props.member.family.copyFromClone(saveClone.family);
        }
        else {
            // Copy over clone
            patchMemberWithReviewed(cloned.value);
            props.member.family.copyFromClone(cloned.value.family);
        }

        if (isDuplicate.value) {
            Toast.success($t('c113898b-d8ce-47ca-915d-2d069496aa88', { name: cloned.value.patchedMember.details.firstName })).show();
            isDuplicate.value = false;
        }

        if (props.saveHandler) {
            await props.saveHandler({
                show, present, dismiss, pop,
            });
        }
        else {
            await pop({ force: true });
        }
    }
    catch (e) {
        if (isSimpleError(e) || isSimpleErrors(e)) {
            if (e.hasCode('known_member_missing_rights')) {
                isDuplicate.value = true;
                loading.value = false;
                return;
            }
        }
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

const hasChanges = computed(() => {
    return cloned.value.isNew || patchContainsChanges(cloned.value.patch, cloned.value.member, { version: Version });
});

async function shouldNavigateAway() {
    if (!hasChanges.value && !loading.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});

</script>

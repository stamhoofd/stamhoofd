<template>
    <SaveView :title="title" :loading="loading" :save-text="isDuplicate ? $t('2a9075bb-a743-411e-8a3d-94e5e57363f0') : saveText" data-testid="member-step" @save="save">
        <template v-if="isDuplicate">
            <h1>{{ $t('f59ba68b-d007-40f2-9b87-fc5605ec55ea', {member: cloned.patchedMember.details.firstName}) }}</h1>
            <p>{{ $t('9474f01d-e447-4a95-986e-247917765ecb', {member: cloned.patchedMember.details.firstName}) }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STInputBox error-fields="code" :error-box="errors.errorBox" class="max" :title="$t(`0fa4253f-1cfd-4394-93b4-dfba8da04738`)">
                <CodeInput v-model="code" :code-length="16" :space-length="4" :numbers-only="false" @complete="save" />
            </STInputBox>

            <hr><h2>{{ $t('61b95651-a851-4a09-9850-9be0542b4c79') }}</h2>

            <STList class="illustration-list">
                <STListItem class="left-center">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/communication.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('3292499d-c4db-4429-9f90-c6ce25713d2d') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('f5229cc1-c908-4409-855a-1dba40371815') }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('0de51cb5-c474-4ec9-9218-4d6709628675') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('52161405-1c8f-4abc-adc3-969bcb0f607f') }}
                    </p>
                </STListItem>
            </STList>
        </template>
        <component :is="component" v-else :title="title" :validator="errors.validator" :parent-error-box="errors.errorBox" :member="cloned" :will-mark-reviewed="willMarkReviewed" v-bind="$attrs" :level="1" />
    </SaveView>
</template>

<script setup lang="ts">
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { useDismiss, usePop, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { Address, PlatformMember, Version } from '@stamhoofd/structures';
import { ComponentOptions, computed, onActivated, Ref, ref } from 'vue';

import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
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
        markReviewed?: string[];
        saveHandler?: ((navigate: NavigationActions) => Promise<void> | void) | null;
    }>(), {
        saveText: () => $t(`14abcd1e-7e65-4e84-be4c-ab2e162ae44d`),
        saveHandler: null,
        markReviewed: () => [],
    },
);

// We use a clone, so we don't propate the patches to the rest of the app until the save was successful
const cloned = ref(props.member.clone() as any) as Ref<PlatformMember>;

onActivated(() => {
    /**
     * Update the clone when the component is activated again
     * because the member could have been patched in other steps.
     */
    const newClone = props.member.clone();
    newClone.addPatch(cloned.value.patch);
    cloned.value = newClone;
});

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
                    message: $t(`aadde496-77b6-4281-893e-3215ae73a183`),
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

        const old = cloned.value.member.details.address;
        const updated = cloned.value.patchedMember.details.address;

        if (old !== null && updated !== null && old.toString() !== updated.toString()) {
            await modifyAddress(old, updated);
        }

        // Extra clone for saving, so the view doesn't change during saving
        const saveClone = cloned.value.clone();
        patchMemberWithReviewed(saveClone);
        await manager.save(saveClone.family.members);
        props.member.family.copyFromClone(saveClone.family);

        // Note: we don't yet update our local 'cloned' value. We'll do so if we ever return to this view (onActivated will update it).

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

async function modifyAddress(from: Address, to: Address) {
    const occurrences = cloned.value.family.getAddressOccurrences(from, { memberId: props.member.patchedMember.id });

    if (occurrences.length === 0) {
        return;
    }

    if (!await CenteredMessage.confirm($t(`14a6da51-a82f-43b5-9e6a-2d679985d41a`), $t(`4d5e0d3f-688a-4c8b-bad7-818d976166bf`), from.shortString() + ' ' + $t(`acebb7f5-73f6-448c-842b-361da931462f`) + ' ' + Formatter.joinLast(occurrences, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') + $t(`f5962c80-7c80-4d05-a4fe-8a842270d280`) + ' ' + to.shortString() + '.', $t(`fe636d8c-6506-4c8b-bb79-9c20fb1bc54d`), false)) {
        return;
    }

    cloned.value.family.updateAddress(from, to);
}

const hasChanges = computed(() => {
    return cloned.value.isNew || patchContainsChanges(cloned.value.patch, cloned.value.member, { version: Version });
});

async function shouldNavigateAway() {
    if (!hasChanges.value && !loading.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`1cb53933-ed06-45ae-9240-dd389298823c`), $t(`106b3169-6336-48b8-8544-4512d42c4fd6`));
}

defineExpose({
    shouldNavigateAway,
});

</script>

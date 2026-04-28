<template>
    <SaveView :title="title" :loading="loading" :save-text="isDuplicate ? $t('%16p') : saveText" data-testid="member-step" @save="save">
        <template v-if="isDuplicate">
            <h1>{{ $t('%dx', {member: cloned.patchedMember.details.firstName}) }}</h1>
            <p>{{ $t('%dy', {member: cloned.patchedMember.details.firstName}) }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STInputBox error-fields="code" :error-box="errors.errorBox" class="max" :title="$t(`%wE`)">
                <CodeInput v-model="code" :code-length="16" :space-length="4" :numbers-only="false" @complete="save" />
            </STInputBox>

            <hr><h2>{{ $t('%dz') }}</h2>

            <STList class="illustration-list">
                <STListItem class="left-center">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/communication.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%e0') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%7h') }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/email.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('%e1') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('%e2') }}
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
import type { Address, PlatformMember, ReviewTimeType } from '@stamhoofd/structures';
import { Version } from '@stamhoofd/structures';
import type { ComponentOptions, Ref } from 'vue';
import { computed, onActivated, ref } from 'vue';

import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { useAppContext } from '../context';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import CodeInput from '../inputs/CodeInput.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import type { NavigationActions } from '../types/NavigationActions';
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
        markReviewed?: ReviewTimeType[];
        saveHandler?: ((navigate: NavigationActions) => Promise<void> | void) | null;
    }>(), {
        saveText: () => $t(`%1Op`),
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
            times.markReviewed(r, new Date());
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
                    message: $t(`%zO`),
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
            Toast.success($t('%Bl', { name: cloned.value.patchedMember.details.firstName })).show();
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
            // security codes are not available for userMode organization
            if (STAMHOOFD.userMode !== 'organization' && e.hasCode('known_member_missing_rights')) {
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

    if (!await CenteredMessage.confirm($t(`%zP`), $t(`%zQ`), from.shortString() + ' ' + $t(`%zR`) + ' ' + Formatter.joinLast(occurrences, ', ', ' ' + $t(`%M1`) + ' ') + $t(`%zS`) + ' ' + to.shortString() + '.', $t(`%zT`), false)) {
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
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
}

defineExpose({
    shouldNavigateAway,
});

</script>

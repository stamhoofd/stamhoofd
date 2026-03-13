<template>
    <SaveView :loading="saving" :title="isNew ? $t(`%Yv`) : user.name" :disabled="!isNew && !hasChanges" @save="save">
        <template v-if="!getPermissions(user)">
            <h1 v-if="isNew">
                {{ $t('%Yi') }}
            </h1>
            <h1 v-else>
                {{ $t('%Yj') }}
            </h1>
        </template>
        <template v-else>
            <h1 v-if="isNew">
                {{ $t('%Yk') }}
            </h1>
            <h1 v-else-if="!user.memberId">
                {{ $t('%Yl') }}
            </h1>
            <h1 v-else>
                {{ $t('%Ym') }}
            </h1>
        </template>

        <LoadingButton v-if="getPermissions(user) && !isNew && !user.hasAccount" :loading="sendingInvite">
            <button class="warning-box with-button" type="button" :class="{selectable: !didSendInvite}" @click="resendInvite">
                {{ $t('%Yn') }}

                <span class="button text" :class="{disabled: didSendInvite}">
                    {{ $t('%Yo') }}
                </span>
            </button>
        </LoadingButton>

        <p v-if="getPermissions(user) && !user.memberId" class="info-box">
            {{ $t('%Yp') }}
        </p>

        <STErrorsDefault :error-box="$errors.errorBox" />
        <STInputBox error-fields="firstName,lastName" :error-box="$errors.errorBox" :title="$t(`%Gq`)">
            <div class="input-group">
                <div>
                    <input v-model="firstName" enterkeyhint="next" class="input" type="text" autocomplete="given-name" :disabled="!canEditDetails" :placeholder="$t(`%1MT`)">
                </div>
                <div>
                    <input v-model="lastName" enterkeyhint="next" class="input" type="text" autocomplete="family-name" :disabled="!canEditDetails" :placeholder="$t(`%1MU`)">
                </div>
            </div>
        </STInputBox>

        <EmailInput v-model="email" :validator="$errors.validator" :required="true" :disabled="!canEditDetails" :title="$t(`%1FK`)" :placeholder="$t(`%1FK`)" />

        <template v-if="getUnloadedPermissions(user)">
            <div v-if="!user.memberId || getUnloadedPermissions(user)" class="container">
                <hr><h2>{{ $t('%Jm') }}</h2>
                <p>{{ $t('%Yq') }}</p>

                <EditUserPermissionsBox :user="patched" @patch:user="(event) => addPatch(event)" />
            </div>

            <div v-if="resources.length" class="container">
                <hr><h2>{{ $t('%Yr') }}</h2>
                <p>{{ $t('%Ys') }}</p>

                <STList>
                    <ResourcePermissionRow v-for="resource in resources" :key="resource.id" :role="permissions.unloadedPermissions!" :resource="resource" :configurable-access-rights="[]" type="resource" @patch:role="addPermissionPatch" />
                </STList>
            </div>
        </template>
        <p v-else class="style-description-small">
            {{ $t('%Yt') }}
        </p>
        <code v-if="STAMHOOFD.environment === 'development'" class="style-code">{{ JSON.stringify(getUnloadedPermissions(user)?.encode({version: 1000}), undefined, '    ') }}</code>

        <template v-if="!isNew && getUnloadedPermissions(user)">
            <hr v-if="!isNew"><h2>
                {{ $t('%CJ') }}
            </h2>
            <p>{{ $t('%Yu') }}</p>

            <button class="button secundary danger" type="button" @click="doDelete()">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import EditUserPermissionsBox from '#admins/components/EditUserPermissionsBox.vue';
import EmailInput from '#inputs/EmailInput.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { GlobalEventBus } from '#EventBus.ts';
import SaveView from '#navigation/SaveView.vue';
import { Toast } from '#overlays/Toast.ts';
import { useContext } from '#hooks/useContext.ts';
import { useErrors } from '#errors/useErrors.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { useUninheritedPermissions } from '#hooks/useUninheritedPermissions.ts';
import { Permissions, PermissionsResourceType, User, UserWithMembers } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import ResourcePermissionRow from './components/ResourcePermissionRow.vue';
import { useAdmins } from './hooks/useAdmins';

const $errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const didSendInvite = ref(false);
const sendingInvite = ref(false);
const $context = useContext();
const pop = usePop();

const props = defineProps<{
    user: UserWithMembers;
    isNew: boolean;
}>();

const { patch, patched, addPatch, hasChanges } = usePatch(props.user);
const { pushInMemory, dropFromMemory, getPermissionsPatch, getPermissions, getUnloadedPermissions } = useAdmins();
const permissions = useUninheritedPermissions({ patchedUser: patched });
const resources = computed(() => {
    const raw = permissions.unloadedPermissions;
    if (!raw) {
        return [];
    }
    const list: { id: string; name: string; type: PermissionsResourceType }[] = [];
    for (const [type, p] of raw.resources.entries()) {
        for (const [id, resource] of p.entries()) {
            list.push({ id, name: resource.resourceName, type });
        }
    }
    return list;
});

const canEditDetails = computed(() => {
    return patched.value.id === $context.value?.user?.id || (!patched.value.hasAccount && (!patched.value?.permissions?.globalPermissions || $context.value.auth.hasPlatformFullAccess()));
});

const addPermissionPatch = (patch: AutoEncoderPatchType<Permissions>) => {
    addPatch(User.patch({
        permissions: getPermissionsPatch(patched.value, patch),
    }));
};

const save = async () => {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;

    const errors = new SimpleErrors();

    if ((firstName.value?.length ?? 0) < 2) {
        errors.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`%uH`),
            field: 'firstName',
        }));
    }
    if ((lastName.value?.length ?? 0) < 2) {
        errors.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`%104`),
            field: 'lastName',
        }));
    }

    let valid = false;

    if (errors.errors.length > 0) {
        $errors.errorBox = new ErrorBox(errors);
    }
    else {
        $errors.errorBox = null;
        valid = true;
    }
    valid = valid && await $errors.validator.validate();

    // TODO: validate if at least email or name is filled in

    if (!valid) {
        saving.value = false;
        return;
    }

    try {
        let user: User;
        if (props.isNew) {
            const response = await $context.value.authenticatedServer.request({
                method: 'POST',
                path: '/user',
                body: patched.value,
                decoder: UserWithMembers as Decoder<UserWithMembers>,
            });
            user = response.data;
            new Toast($t(`%14i`, { firstName: user.firstName || user.email }), 'success').setHide(5000).show();
        }
        else {
            const response = await $context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/user/' + patched.value.id,
                body: patch.value,
                decoder: UserWithMembers as Decoder<UserWithMembers>,
            });
            user = response.data;
            new Toast($t(`%14j`), 'success').setHide(2000).show();
        }

        // Copy all data
        props.user.deepSet(user);

        // Push user to admins
        if (props.isNew) {
            pushInMemory(props.user);
        }
        await GlobalEventBus.sendEvent('user-updated', props.user);
        await pop({ force: true });
    }
    catch (e) {
        console.error(e);
        $errors.errorBox = new ErrorBox(e);
        saving.value = false;
    }
};
const doDelete = async () => {
    if (deleting.value || saving.value) {
        return false;
    }

    if (props.isNew) {
        return false;
    }

    if (!await CenteredMessage.confirm($t(`%uI`), $t(`%CJ`))) {
        return false;
    }

    deleting.value = true;

    try {
        // Patch the user
        const response = await $context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/user/' + props.user.id,
            body: User.patch({
                id: props.user.id,
                permissions: getPermissionsPatch(props.user, null),
            }),
            decoder: UserWithMembers as Decoder<UserWithMembers>,
        });

        // Copy all data
        props.user.deepSet(response.data);

        if (getPermissions(props.user)?.isEmpty ?? true) {
            dropFromMemory(props.user);
        }

        await pop({ force: true });

        new Toast(
            $t('%14h', { firstName: props.user.firstName ?? props.user.email }),
            'success',
        ).setHide(2000).show();
    }
    catch (e) {
        console.error(e);
        $errors.errorBox = new ErrorBox(e);
        deleting.value = false;
    }
    return false;
};
const resendInvite = async () => {
    // We can send a new invite by just recreating the admin (the API will merge with existing admins)
    if (hasChanges.value || props.isNew) {
        new CenteredMessage($t(`%uJ`), $t(`%uK`)).addCloseButton().show();
        return;
    }
    if (sendingInvite.value) {
        return;
    }
    sendingInvite.value = true;

    try {
        // Note: we don't use the patchedUser, because that would save any changes too
        const response = await $context.value.authenticatedServer.request({
            method: 'POST',
            path: '/user',
            body: props.user,
            decoder: User as Decoder<User>,
        });

        // Copy all data
        props.user.set(response.data);
        didSendInvite.value = true;

        new Toast($t(`%uL`) + ' ' + props.user.email, 'success').setHide(2000).show();
    }
    catch (e) {
        console.error(e);
        $errors.errorBox = new ErrorBox(e);
    }
    sendingInvite.value = false;
};

const firstName = computed({
    get: () => patched.value.firstName,
    set: (value: string | null) => addPatch({ firstName: value }),
});

const lastName = computed({
    get: () => patched.value.lastName,
    set: (value: string | null) => addPatch({ lastName: value }),
});

const email = computed({
    get: () => patched.value.email,
    set: (value: string) => addPatch({ email: value }),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
};

defineExpose({
    shouldNavigateAway,
});
</script>

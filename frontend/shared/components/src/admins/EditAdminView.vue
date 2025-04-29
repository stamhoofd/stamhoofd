<template>
    <SaveView :loading="saving" :title="isNew ? $t(`de44cdb8-fb65-4e7b-b57a-ae0571db1ab4`) : user.name" :disabled="!isNew && !hasChanges" @save="save">
        <template v-if="!getPermissions(user)">
            <h1 v-if="isNew">
                {{ $t('fa7b2b7e-57a0-435c-b4e5-0ce5d4d82407') }}
            </h1>
            <h1 v-else>
                {{ $t('da046234-ae13-4c33-9556-b58a8c0eb9af') }}
            </h1>
        </template>
        <template v-else>
            <h1 v-if="isNew">
                {{ $t('35a636fb-a11c-4cbd-b648-3332cde7b587') }}
            </h1>
            <h1 v-else-if="!user.memberId">
                {{ $t('9be57c4c-f9e2-40c2-932b-99b0a330365c') }}
            </h1>
            <h1 v-else>
                {{ $t('992282bb-d879-4cde-90bc-afb558a3026f') }}
            </h1>
        </template>

        <LoadingButton v-if="getPermissions(user) && !isNew && !user.hasAccount" :loading="sendingInvite">
            <button class="warning-box with-button" type="button" :class="{selectable: !didSendInvite}" @click="resendInvite">
                {{ $t('32e29a00-7799-49ec-9755-30a1e429fea4') }}

                <span class="button text" :class="{disabled: didSendInvite}">
                    {{ $t('fdca4ebb-8515-4e97-9474-2658d5c47436') }}
                </span>
            </button>
        </LoadingButton>

        <p v-if="getPermissions(user) && !user.memberId" class="info-box">
            {{ $t('933f7954-e0bb-4e04-bd4a-9c4ea07fee74') }}
        </p>

        <STErrorsDefault :error-box="$errors.errorBox" />
        <STInputBox error-fields="firstName,lastName" :error-box="$errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <div class="input-group">
                <div>
                    <input v-model="firstName" enterkeyhint="next" class="input" type="text" autocomplete="given-name" :disabled="!canEditDetails" :placeholder="$t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`)">
                </div>
                <div>
                    <input v-model="lastName" enterkeyhint="next" class="input" type="text" autocomplete="family-name" :disabled="!canEditDetails" :placeholder="$t(`171bd1df-ed4b-417f-8c5e-0546d948469a`)">
                </div>
            </div>
        </STInputBox>

        <EmailInput v-model="email" :validator="$errors.validator" :required="true" :disabled="!canEditDetails" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" :placeholder="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" />

        <template v-if="getUnloadedPermissions(user)">
            <div v-if="!user.memberId || getUnloadedPermissions(user)" class="container">
                <hr><h2>{{ $t('697d96d8-17dc-4e98-8571-87153985f3a1') }}</h2>
                <p>{{ $t('a6008859-e90b-4219-b64d-9ebc6e88f25c') }}</p>

                <EditUserPermissionsBox :user="patched" @patch:user="(event) => addPatch(event)" />
            </div>

            <div v-if="resources.length" class="container">
                <hr><h2>{{ $t('12cf18a0-ce20-4cec-8622-a55ed1ab65d7') }}</h2>
                <p>{{ $t('053d536d-3096-4450-8879-bb0fad04d96b') }}</p>

                <STList>
                    <ResourcePermissionRow v-for="resource in resources" :key="resource.id" :role="permissions.unloadedPermissions!" :resource="resource" :configurable-access-rights="[]" type="resource" @patch:role="addPermissionPatch" />
                </STList>
            </div>
        </template>
        <p v-else class="style-description-small">
            {{ $t('14637b25-c719-40bc-a4c3-6108341c7c40') }}
        </p>
        <code v-if="STAMHOOFD.environment === 'development'" class="style-code">{{ JSON.stringify(getUnloadedPermissions(user)?.encode({version: 1000}), undefined, '    ') }}</code>

        <template v-if="!isNew && getUnloadedPermissions(user)">
            <hr v-if="!isNew"><h2>
                {{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}
            </h2>
            <p>{{ $t('45b52b33-dfa4-4afa-81d2-d598626b2701') }}</p>

            <button class="button secundary danger" type="button" @click="doDelete()">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, EditUserPermissionsBox, EmailInput, ErrorBox, GlobalEventBus, SaveView, Toast, useContext, useErrors, usePatch, useUninheritedPermissions } from '@stamhoofd/components';
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
            message: $t(`1186a60b-c59f-43d5-ba58-04ff9288c266`),
            field: 'firstName',
        }));
    }
    if ((lastName.value?.length ?? 0) < 2) {
        errors.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`d26a3f0b-667f-463c-ac49-8aab0462c0c3`),
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
            new Toast($t(`{firstName} is toegevoegd als beheerder en heeft een uitnodiging via email ontvangen.`, { firstName: user.firstName || user.email }), 'success').setHide(5000).show();
        }
        else {
            const response = await $context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/user/' + patched.value.id,
                body: patch.value,
                decoder: UserWithMembers as Decoder<UserWithMembers>,
            });
            user = response.data;
            new Toast($t(`De beheerder is aangepast`), 'success').setHide(2000).show();
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

    if (!await CenteredMessage.confirm($t(`e8b646d5-1377-465e-b29d-163d437e5c02`), $t(`25d866b7-3859-4a5d-b875-bc286e69f846`))) {
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
            $t('Beheerder {firstName} werd verwijderd', { firstName: props.user.firstName ?? props.user.email }),
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
        new CenteredMessage($t(`88f254ee-bc8c-4a2f-9a00-9e9102354268`), $t(`acc4cfd1-42ad-45a2-bb1e-841b52f7c4e6`)).addCloseButton().show();
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

        new Toast($t(`a94e08c1-bddf-4f13-af83-8349dc361a47`) + ' ' + props.user.email, 'success').setHide(2000).show();
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
    return await CenteredMessage.confirm($t(`3953d383-4f04-42ea-83cd-bf65478ed4a9`), $t(`4cfb2940-8532-446e-b543-a4c7ba9618a3`));
};

defineExpose({
    shouldNavigateAway,
});
</script>

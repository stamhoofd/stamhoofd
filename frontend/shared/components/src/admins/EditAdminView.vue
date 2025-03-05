<template>
    <SaveView :loading="saving" :title="isNew ? $t(`6626e539-9272-4c64-8d86-1823818d09e5`) : user.name" :disabled="!isNew && !hasChanges" @save="save">
        <template v-if="!getPermissions(user)">
            <h1 v-if="isNew">
                {{ $t('2ef4dbf3-4331-4a6e-a107-833a13b2336b') }}
            </h1>
            <h1 v-else>
                {{ $t('67ed5056-f8b4-43cf-9ba3-f15834522015') }}
            </h1>
        </template>
        <template v-else>
            <h1 v-if="isNew">
                {{ $t('0c771b30-e015-4238-8d2e-16b9ee40f6b4') }}
            </h1>
            <h1 v-else-if="!user.memberId">
                {{ $t('ebf527d0-3d30-4fd2-b094-ca36f32d9a43') }}
            </h1>
            <h1 v-else>
                {{ $t('581659c3-6607-4289-b508-b98d97ec66ed') }}
            </h1>
        </template>

        <LoadingButton v-if="getPermissions(user) && !isNew && !user.hasAccount" :loading="sendingInvite">
            <button class="warning-box with-button" type="button" :class="{selectable: !didSendInvite}" @click="resendInvite">
                {{ $t('fc593f4b-1ae0-4497-aee9-3830c7085e0c') }}

                <span class="button text" :class="{disabled: didSendInvite}">
                    {{ $t('2b39b344-9366-4bc6-9259-fbfadb3750b7') }}
                </span>
            </button>
        </LoadingButton>

        <p v-if="getPermissions(user) && !user.memberId" class="info-box">
            {{ $t('a213a54f-9769-4a19-8c8a-bb6e76bb43b3') }}
        </p>

        <STErrorsDefault :error-box="$errors.errorBox"/>
        <STInputBox error-fields="firstName,lastName" :error-box="$errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <div class="input-group">
                <div>
                    <input v-model="firstName" enterkeyhint="next" class="input" type="text" autocomplete="given-name" :disabled="!canEditDetails" :placeholder="$t(`883f9695-e18f-4df6-8c0d-651c6dd48e59`)"></div>
                <div>
                    <input v-model="lastName" enterkeyhint="next" class="input" type="text" autocomplete="family-name" :disabled="!canEditDetails" :placeholder="$t(`f89d8bfa-6b5d-444d-a40f-ec17b3f456ee`)"></div>
            </div>
        </STInputBox>

        <EmailInput v-model="email" :validator="$errors.validator" :required="true" :disabled="!canEditDetails" :title="$t(`0be79160-b242-44dd-94f0-760093f7f9f2`)" :placeholder="$t(`0be79160-b242-44dd-94f0-760093f7f9f2`)"/>

        <template v-if="getUnloadedPermissions(user)">
            <div v-if="!user.memberId || getUnloadedPermissions(user)" class="container">
                <hr><h2>{{ $t('748cdc4a-0915-42bb-b0e4-eb26d6659b35') }}</h2>
                <p>{{ $t('c5acf47c-1836-4839-8b88-90182418829d') }}</p>

                <EditUserPermissionsBox :user="patched" @patch:user="(event) => addPatch(event)"/>
            </div>

            <div v-if="resources.length" class="container">
                <hr><h2>{{ $t('d5758c82-f301-4860-b309-7b72e7cf0156') }}</h2>
                <p>{{ $t('d7d7a1cc-ff85-40d8-bf6c-af5bf7da3aae') }}</p>

                <STList>
                    <ResourcePermissionRow v-for="resource in resources" :key="resource.id" :role="permissions.unloadedPermissions!" :resource="resource" :configurable-access-rights="[]" type="resource" @patch:role="addPermissionPatch"/>
                </STList>
            </div>
        </template>
        <p v-else class="style-description-small">
            {{ $t('b7017b6a-893f-4476-b4bd-d9b5cc835d95') }}
        </p>
        <code v-if="STAMHOOFD.environment === 'development'" class="style-code">{{ JSON.stringify(getUnloadedPermissions(user)?.encode({version: 1000}), undefined, '    ') }}</code>

        <template v-if="!isNew && getUnloadedPermissions(user)">
            <hr v-if="!isNew"><h2>
                {{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}
            </h2>
            <p>{{ $t('6f459971-e5e0-4ba8-9132-8cc0f2d22bf4') }}</p>

            <button class="button secundary danger" type="button" @click="doDelete()">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
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
            message: 'Vul de voornaam in',
            field: 'firstName',
        }));
    }
    if ((lastName.value?.length ?? 0) < 2) {
        errors.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Vul de achternaam in',
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
            new Toast('Beheerder ' + user.firstName + ' is toegevoegd en heeft een uitnodiging via email ontvangen.', 'success').setHide(5000).show();
        }
        else {
            const response = await $context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/user/' + patched.value.id,
                body: patch.value,
                decoder: UserWithMembers as Decoder<UserWithMembers>,
            });
            user = response.data;
            new Toast('Beheerder ' + user.firstName + ' is aangepast', 'success').setHide(2000).show();
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

    if (!await CenteredMessage.confirm('Ben je zeker dat je deze beheerder wilt verwijderen?', 'Verwijderen')) {
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

        new Toast('Beheerder ' + props.user.firstName + ' is verwijderd', 'success').setHide(2000).show();
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
        new CenteredMessage('Wijzigingen niet opgeslagen', 'Voor je een uitnodiging opnieuw kan versturen moet je alle wijzigingen opslaan of annuleren.').addCloseButton().show();
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

        new Toast('Uitnodiging verzonden naar ' + props.user.email, 'success').setHide(2000).show();
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
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});
</script>

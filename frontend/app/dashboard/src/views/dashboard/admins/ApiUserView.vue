<template>
    <SaveView :loading="saving" :title="title" :disabled="!isNew && !hasChanges" @save="save" v-on="!isNew ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input v-model="name" enterkeyhint="next" class="input" type="text" :placeholder="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
        </STInputBox>

        <div class="container">
            <hr><h2>{{ $t('697d96d8-17dc-4e98-8571-87153985f3a1') }}</h2>
            <p>{{ $t('b1cb5299-5325-4505-ba30-a7b0ae327679') }}</p>

            <EditUserPermissionsBox :user="patched" @patch:user="addPatch($event)" />
        </div>

        <div class="container">
            <hr><h2>{{ $t('40abbf9c-2dd3-471a-a699-f6af656feb5e') }}</h2>
            <p>{{ $t('664063fe-6e8f-4439-bb86-07d346e803de') }}</p>

            <STList>
                <STListItem v-if="canAlterRateLimits || rateLimits === ApiUserRateLimits.Normal" :selectable="canAlterRateLimits" class="right-stack right-top" element-name="label">
                    <template v-if="canAlterRateLimits" #left>
                        <Radio v-model="rateLimits" :value="ApiUserRateLimits.Normal" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('ab858fd6-4451-4d88-869e-be425a661169') }}
                    </h3>
                    <p v-if="canAlterRateLimits" class="style-description-small">
                        {{ $t('288fd815-8771-4524-9e4d-6e90bd2eec11') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('be918896-7e92-4ac7-9cbe-fba5afdd8120') }}
                    </p>

                    <template v-if="canAlterRateLimits" #right>
                        <span class="style-tag">{{ $t('706d4485-be6b-418c-bbf1-5fe05e34e076') }}</span>
                    </template>
                </STListItem>

                <STListItem v-if="canAlterRateLimits || rateLimits === ApiUserRateLimits.Medium" :selectable="canAlterRateLimits" class="right-stack right-top" element-name="label">
                    <template v-if="canAlterRateLimits" #left>
                        <Radio v-model="rateLimits" :value="ApiUserRateLimits.Medium" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('36c579f6-0c98-4946-9d6b-eec3f0db56d6') }}
                    </h3>
                    <p v-if="canAlterRateLimits" class="style-description-small">
                        {{ $t('cc4f0640-cdfb-473f-9f94-cc6e11b361ae') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('c1bfbd59-c12d-43e2-88f7-aa08798d1ea6') }}
                    </p>
                </STListItem>

                <STListItem v-if="canAlterRateLimits || rateLimits === ApiUserRateLimits.High" :selectable="canAlterRateLimits" class="right-stack right-top" element-name="label">
                    <template v-if="canAlterRateLimits" #left>
                        <Radio v-model="rateLimits" :value="ApiUserRateLimits.High" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('98469c78-6bd6-4354-b7d2-07e5b48aec12') }}
                    </h3>
                    <p v-if="canAlterRateLimits" class="style-description-small">
                        {{ $t('a379312a-007d-46a2-9533-33c15c524504') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('f1597fb7-dd45-4d0c-8efc-627b464e6d1b') }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, EditUserPermissionsBox, ErrorBox, SaveView, Toast, useAuth, useContext, useErrors, usePatch } from '@stamhoofd/components';
import { ApiUser, ApiUserRateLimits, ApiUserWithToken, UserMeta } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import CopyApiTokenView from './CopyApiTokenView.vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $context = useContext();
const pop = usePop();
const show = useShow();
const auth = useAuth();
const canAlterRateLimits = auth.hasPlatformFullAccess();

const props = defineProps<{
    user: ApiUser;
    isNew: boolean;
    callback: () => void;
}>();
const { patch, patched, addPatch, hasChanges } = usePatch(props.user);

const title = computed(() => {
    if (props.isNew) {
        return $t(`e5c619de-2d3d-470f-857b-185912b9784e`);
    }
    return $t(`ce422f34-27a2-4dab-b307-d3aaecb9f5b7`);
});

const name = computed({
    get: () => patched.value.name ?? '',
    set: (value: string) => addPatch({ name: value ? value : null }),
});

const rateLimits = computed({
    get: () => patched.value.meta?.rateLimits ?? ApiUserRateLimits.Normal,
    set: (value: ApiUserRateLimits) => addPatch({
        meta: UserMeta.patch({
            rateLimits: value,
        }),
    }),
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;

    const errorGroup = new SimpleErrors();

    if ((name.value?.length ?? 0) < 2) {
        errorGroup.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`769aee89-b291-4c53-90ec-16539bca5a33`),
            field: 'name',
        }));
    }

    let valid = false;

    if (errorGroup.errors.length > 0) {
        errors.errorBox = new ErrorBox(errorGroup);
    }
    else {
        errors.errorBox = null;
        valid = true;
    }
    valid = valid && await errors.validator.validate();

    if (!valid) {
        saving.value = false;
        return;
    }

    try {
        let user: ApiUser | ApiUserWithToken;
        if (props.isNew) {
            const response = await $context.value.authenticatedServer.request({
                method: 'POST',
                path: '/api-keys',
                body: patched.value,
                decoder: ApiUserWithToken as Decoder<ApiUserWithToken>,
            });
            user = response.data;
        }
        else {
            const response = await $context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/api-keys/' + patched.value.id,
                body: patch.value,
                decoder: ApiUser as Decoder<ApiUser>,
            });
            user = response.data;
        }

        // Copy all data
        props.user.deepSet(user);
        props.callback();

        if (props.isNew) {
            await show({
                components: [
                    new ComponentWithProperties(CopyApiTokenView, { user }),
                ],
                replace: 1,
                animated: true,
                force: true,
            });
        }
        else {
            Toast.success($t('d2047614-32d8-436f-9b95-dff31cfe20de', { name: user.name ?? '?' })).setHide(5000).show();
            await pop({ force: true });
        }
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        saving.value = false;
    }
};

async function doDelete() {
    if (deleting.value || saving.value) {
        return false;
    }

    if (props.isNew) {
        return false;
    }

    if (!await CenteredMessage.confirm($t('7b900dda-9d43-4373-ae86-34ec7f236cca'), $t('14f2d606-a7c9-4cdf-9ee9-aca38beb9689'))) {
        return false;
    }

    deleting.value = true;

    try {
        // Patch the user
        await $context.value.authenticatedServer.request({
            method: 'DELETE',
            path: '/api-keys/' + props.user.id,
        });
        props.callback();

        await pop({ force: true });

        deleting.value = false;
        Toast.success($t('5fd1f84b-ed82-4022-80d0-49caad220c88', { name: props.user.name ?? '?' })).setHide(2000).show();
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        deleting.value = false;
    }
    return false;
};

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('545f3db5-ae26-41dd-8771-e123bc2b583e'), $t('f0c89199-09c8-48d4-ad73-bff0ac426df8'));
};

defineExpose({
    shouldNavigateAway,
});

/* import { AutoEncoderPatchType, Decoder, PartialWithoutMethods, patchContainsChanges, PatchType } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, EmailInput, ErrorBox, SaveView, Spinner, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator, EditUserPermissionsBox } from '@stamhoofd/components';
import Tooltip from '@stamhoofd/components/src/directives/Tooltip';
import { ApiUser, ApiUserWithToken, PermissionLevel, Permissions, User, UserPermissions, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import CopyApiTokenView from './CopyApiTokenView.vue';

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        Checkbox,
        EmailInput,
        STList,
        STListItem,
        Spinner,
        SaveView,
        EditUserPermissionsBox,
    },
    directives: {
        tooltip: Tooltip,
    },
    filters: {
        date: Formatter.date.bind(Formatter),
    },
})
export default class ApiUserView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;
    deleting = false;

    @Prop({ required: true })
    user!: ApiUser;

    @Prop({ required: true })
    callback!: () => void;

    patchUser: AutoEncoderPatchType<ApiUser> = ApiUser.patch({ id: this.user.id });

    @Prop({ required: true })
    isNew!: boolean;

    get hasChanges() {
        return patchContainsChanges(this.patchUser, this.user, { version: Version });
    }

    get title() {
        if (this.isNew) {
            return 'Nieuwe API-key';
        }
        return 'API-key bewerken';
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }

    get organization() {
        return this.$organization;
    }

    get patchedUser() {
        return this.user.patch(this.patchUser);
    }

    get fullAccess() {
        return !!this.patchedUser.permissions?.forOrganization(this.organization)?.hasFullAccess();
    }

    async save() {
        if (this.deleting || this.saving) {
            return;
        }

        this.saving = true;

        const errors = new SimpleErrors();

        if (this.name.length < 2) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                message: 'Vul een naam in',
                field: 'name',
            }));
        }

        let valid = false;

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors);
        }
        else {
            this.errorBox = null;
            valid = true;
        }
        valid = valid && await this.validator.validate();

        // TODO: validate if at least email or name is filled in

        if (!valid) {
            this.saving = false;
            return;
        }

        const permissions = Permissions.patch({ level: this.fullAccess ? PermissionLevel.Full : (PermissionLevel.None) });
        this.addPermissionsPatch(permissions);

        try {
            let user: ApiUser;
            if (this.isNew) {
                const response = await this.$context.authenticatedServer.request({
                    method: 'POST',
                    path: '/api-keys',
                    body: this.patchedUser,
                    decoder: ApiUserWithToken as Decoder<ApiUserWithToken>,
                });
                user = response.data;
            }
            else {
                const response = await this.$context.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/api-keys/' + this.user.id,
                    body: this.patchUser,
                    decoder: ApiUser as Decoder<ApiUser>,
                });
                user = response.data;
            }

            // Copy all data
            this.user.deepSet(user);
            this.patchUser = ApiUser.patch({ id: this.user.id });

            this.callback();

            if (this.isNew) {
                this.show({
                    components: [
                        new ComponentWithProperties(CopyApiTokenView, { user }),
                    ],
                    replace: 1,
                    animated: true,
                });
            }
            else {
                this.pop({ force: true });
                this.saving = false;
            }
        }
        catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e);
            this.saving = false;
        }
    }

    async deleteMe() {
        if (this.deleting || this.saving) {
            return false;
        }

        if (this.isNew) {
            return false;
        }

        if (!await CenteredMessage.confirm('Ben je zeker dat je deze API-key wilt verwijderen?', 'Verwijderen')) {
            return false;
        }

        this.deleting = true;

        try {
            // Patch the user
            await this.$context.authenticatedServer.request({
                method: 'DELETE',
                path: '/api-keys/' + this.user.id,
            });

            this.callback();
            this.pop({ force: true });
            this.deleting = false;

            new Toast("API-key '" + this.user.name + "' werd verwijderd", 'success').setHide(2000).show();
        }
        catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e);
            this.deleting = false;
        }
        return false;
    }

    /// --------------------------------------------------------
    /// --------------------- Map helpers ----------------------
    /// --------------------------------------------------------

    addPatch(patch: PartialWithoutMethods<PatchType<User>>) {
        this.patchUser = this.patchUser.patch(patch);
    }

    addPermissionsPatch(patch: PartialWithoutMethods<PatchType<Permissions>>) {
        if (!this.patchedUser.permissions) {
            const base = UserPermissions.create({});
            const p = base.convertPatch(Permissions.patch(patch), this.organization.id);
            this.addPatch({ permissions: base.patch(p) });
            return;
        }

        this.addPatch({ permissions: this.patchedUser.permissions!.convertPatch(Permissions.patch(patch), this.organization.id) });
    }

    /// --------------------------------------------------------
    /// --------------------- Mappers --------------------------
    /// --------------------------------------------------------

    get name() {
        return this.patchedUser.name ?? '';
    }

    set name(name: string) {
        this.addPatch({ name });
    }
} */
</script>

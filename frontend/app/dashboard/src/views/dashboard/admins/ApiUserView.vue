<template>
    <SaveView :loading="saving" :title="title" :disabled="!isNew && !hasChanges" @save="save" v-on="!isNew ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%1Os`)">
            <input v-model="name" enterkeyhint="next" class="input" type="text" :placeholder="$t(`%1Os`)">
        </STInputBox>

        <div class="container">
            <hr><h2>{{ adminRolesTitle }}</h2>
            <p>{{ apiUserRolesDescription }}</p>

            <EditUserPermissionsBox :user="patched" @patch:user="addPatch($event)" />
        </div>

        <div class="container">
            <hr><h2>{{ $t('%r') }}</h2>
            <p>{{ $t('%Jo') }}</p>

            <STList>
                <STListItem v-if="canAlterRateLimits || rateLimits === ApiUserRateLimits.Normal" :selectable="canAlterRateLimits" class="right-stack right-top" element-name="label">
                    <template v-if="canAlterRateLimits" #left>
                        <Radio v-model="rateLimits" :value="ApiUserRateLimits.Normal" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%2W') }}
                    </h3>
                    <p v-if="canAlterRateLimits" class="style-description-small">
                        {{ $t('%Jp') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%Jq') }}
                    </p>

                    <template v-if="canAlterRateLimits" #right>
                        <span class="style-tag">{{ $t('%Jr') }}</span>
                    </template>
                </STListItem>

                <STListItem v-if="canAlterRateLimits || rateLimits === ApiUserRateLimits.Medium" :selectable="canAlterRateLimits" class="right-stack right-top" element-name="label">
                    <template v-if="canAlterRateLimits" #left>
                        <Radio v-model="rateLimits" :value="ApiUserRateLimits.Medium" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%Js') }}
                    </h3>
                    <p v-if="canAlterRateLimits" class="style-description-small">
                        {{ $t('%Jt') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%Ju') }}
                    </p>
                </STListItem>

                <STListItem v-if="canAlterRateLimits || rateLimits === ApiUserRateLimits.High" :selectable="canAlterRateLimits" class="right-stack right-top" element-name="label">
                    <template v-if="canAlterRateLimits" #left>
                        <Radio v-model="rateLimits" :value="ApiUserRateLimits.High" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%Jv') }}
                    </h3>
                    <p v-if="canAlterRateLimits" class="style-description-small">
                        {{ $t('%Jw') }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%Jx') }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import EditUserPermissionsBox from '@stamhoofd/components/admins/components/EditUserPermissionsBox.vue';
import { useAdminLabels } from '@stamhoofd/components/admins/hooks/useAdminLabels';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { ApiUser, ApiUserRateLimits, ApiUserWithToken, UserMeta } from '@stamhoofd/structures';
import { computed, ref } from 'vue';


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
const { adminRolesTitle, apiUserRolesDescription } = useAdminLabels();

const title = computed(() => {
    if (props.isNew) {
        return $t(`%Jy`);
    }
    return $t(`%Jz`);
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
            message: $t(`%11M`),
            field: 'name',
        }));
    }

    let valid = false;

    if (errorGroup.errors.length > 0) {
        errors.errorBox = new ErrorBox(errorGroup);
    } else {
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
        } else {
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
                    AsyncComponent(() => import('./CopyApiTokenView.vue'), { user }),
                ],
                replace: 1,
                animated: true,
                force: true,
            });
        } else {
            Toast.success($t('%CH', { name: user.name ?? '?' })).setHide(5000).show();
            await pop({ force: true });
        }
    } catch (e) {
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

    if (!await CenteredMessage.confirm($t('%CI'), $t('%CJ'))) {
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
        Toast.success($t('%CK', { name: props.user.name ?? '?' })).setHide(2000).show();
    } catch (e) {
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>

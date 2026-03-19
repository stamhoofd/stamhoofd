<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('%Gq') ">
            <input v-model="name" class="input" type="text" :placeholder="$t('%Gq') ">
        </STInputBox>

        <STInputBox :title="$t('%6o')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('%14p')" autocomplete="off" />
        </STInputBox>

        <Checkbox v-if="app === 'admin'" v-model="notOrganizationBased">
            {{ $t('%jK') }}
        </Checkbox>

        <template v-if="organizationBased && app === 'admin'">
            <hr><h2>{{ $t('%9V') }}</h2>

            <div class="split-inputs">
                <STInputBox error-fields="settings.minAge" :error-box="errors.errorBox" :title="$t(`%jX`)">
                    <DeprecatedNumberInput v-model="minimumMembers" :required="false" :placeholder="$t(`%1FW`)" />
                </STInputBox>

                <STInputBox error-fields="settings.maxAge" :error-box="errors.errorBox" :title="$t(`%jY`)">
                    <DeprecatedNumberInput v-model="maximumMembers" :required="false" :placeholder="$t(`%4a`)" />
                </STInputBox>
            </div>
        </template>

        <JumpToContainer :visible="organizationTagIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('%wP') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="organizationTagIds = null" />
                </div>
            </h2>
            <p>{{ $t('%jL') }}</p>

            <TagIdsInput v-model="organizationTagIds" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="defaultAgeGroupIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('%P4') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="defaultAgeGroupIds = null" />
                </div>
            </h2>

            <p>{{ $t('%jM') }}</p>

            <DefaultAgeGroupIdsInput v-model="defaultAgeGroupIds" :validator="errors.validator" :should-select-at-least-one="true" />

            <hr><h2>{{ $t('%jN') }}</h2>

            <p>{{ $t('%8Z') }}</p>

            <STList>
                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.None" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1FW') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Read" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%jO') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Write" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%jP') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Full" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%Z1') }}
                    </h3>
                </STListItem>
            </STList>
        </JumpToContainer>

        <template v-if="organizationTagIds === null || defaultAgeGroupIds === null">
            <hr><STList>
                <template v-if="app === 'admin'">
                    <STListItem v-if="organizationTagIds === null && organizationBased" :selectable="true" element-name="button" @click="organizationTagIds = []">
                        <template #left>
                            <span class="icon add gray" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%jQ') }}
                        </h3>
                    </STListItem>

                    <STListItem v-if="defaultAgeGroupIds === null && organizationBased" :selectable="true" element-name="button" @click="defaultAgeGroupIds = []">
                        <template #left>
                            <span class="icon add gray" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%jR') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('%jS') }}
                        </p>
                    </STListItem>
                </template>

                <STListItem :selectable="true" element-name="button" @click="editPermissions">
                    <template #left>
                        <span class="icon privacy gray" />
                    </template>

                    <h3 v-if="!permissions" class="style-title-list">
                        {{ $t('%jT') }}
                    </h3>
                    <h3 v-else class="style-title-list">
                        {{ $t('%jU') }}
                    </h3>

                    <p v-if="organizationBased" class="style-description-small">
                        {{ $t('%jV') }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('%jW') }}
                    </p>
                </STListItem>
            </STList>
        </template>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr><h2>
                {{ $t('%3l') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import EditRoleView from '#admins/EditRoleView.vue';
import JumpToContainer from '#containers/JumpToContainer.vue';
import { useAppContext } from '#context/appContext.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { usePatch } from '#hooks/usePatch.ts';
import DefaultAgeGroupIdsInput from '#inputs/DefaultAgeGroupIdsInput.vue';
import DeprecatedNumberInput from '#inputs/DeprecatedNumberInput.vue';
import TagIdsInput from '#inputs/TagIdsInput.vue';
import SaveView from '#navigation/SaveView.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import type { MemberResponsibility } from '@stamhoofd/structures';
import { PermissionLevel, PermissionRoleForResponsibility } from '@stamhoofd/structures';
import { computed, ref, watchEffect } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const present = usePresent();

const props = defineProps<{
    responsibility: MemberResponsibility;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<MemberResponsibility>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => props.isNew ? $t('%3o') : $t('%3m'));
const pop = usePop();
const app = useAppContext();

const { patched, addPatch, hasChanges, patch } = usePatch(props.responsibility);

watchEffect(() => {
    if (patched.value.permissions && patched.value.permissions.name !== patched.value.name) {
        addPatch({
            permissions: PermissionRoleForResponsibility.patch({ name: patched.value.name }),
        });
    }
});

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (name.value.length < 2) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t('%56'),
                field: 'name',
            });
        }

        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('%3k'), $t('%CJ'), $t('%3j'))) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const description = computed({
    get: () => patched.value.description,
    set: description => addPatch({ description }),
});

const minimumMembers = computed({
    get: () => patched.value.minimumMembers,
    set: minimumMembers => addPatch({ minimumMembers }),
});

const maximumMembers = computed({
    get: () => patched.value.maximumMembers,
    set: maximumMembers => addPatch({ maximumMembers }),
});

const organizationTagIds = computed({
    get: () => patched.value.organizationTagIds,
    set: organizationTagIds => addPatch({
        organizationTagIds: organizationTagIds as any,
    }),
});

const defaultAgeGroupIds = computed({
    get: () => patched.value.defaultAgeGroupIds,
    set: defaultAgeGroupIds => addPatch({
        defaultAgeGroupIds: defaultAgeGroupIds as any,
    }),
});

const groupPermissionLevel = computed({
    get: () => patched.value.groupPermissionLevel,
    set: groupPermissionLevel => addPatch({ groupPermissionLevel }),
});

const permissions = computed({
    get: () => patched.value.permissions,
    set: permissions => addPatch({ permissions }),
});

const organizationBased = computed({
    get: () => patched.value.organizationBased,
    set: organizationBased => addPatch({ organizationBased }),
});

const notOrganizationBased = computed({
    get: () => !organizationBased.value,
    set: notOrganizationBased => organizationBased.value = !notOrganizationBased,
});

async function editPermissions() {
    let isNew = false;
    let role = permissions.value;

    if (!role) {
        role = PermissionRoleForResponsibility.create({
            name: name.value,
            responsibilityId: props.responsibility.id,
            responsibilityGroupId: null,
        });
        isNew = true;
    }

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditRoleView, {
                role,
                isNew,
                scope: organizationBased.value ? 'organization' : 'admin',
                saveHandler: (patch: AutoEncoderPatchType<PermissionRoleForResponsibility>) => {
                    if (isNew) {
                        addPatch({
                            permissions: role.patch(patch),
                        });
                    }
                    else {
                        addPatch({
                            permissions: patch,
                        });
                    }
                },
                deleteHandler: isNew
                    ? null
                    : () => {
                            permissions.value = null;
                        },
            }),
        ],
    });
}

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

<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') ">
            <input v-model="name" class="input" type="text" :placeholder="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') ">
        </STInputBox>

        <STInputBox :title="$t('1c338881-0940-429b-a47e-7c9d3055f533')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('3db64326-c892-4fdb-8293-3d713453383a')" autocomplete="off" />
        </STInputBox>

        <Checkbox v-if="app === 'admin'" v-model="notOrganizationBased">
            {{ $t('e1c5c8b7-0ae4-46d5-b7e9-1d97f388f080') }}
        </Checkbox>

        <template v-if="organizationBased && app === 'admin'">
            <hr><h2>{{ $t('d6ee7c6e-8614-44cc-adab-24ff88ec262c') }}</h2>

            <div class="split-inputs">
                <STInputBox error-fields="settings.minAge" :error-box="errors.errorBox" :title="$t(`17dc0c45-14fb-4296-9b1d-1dddccf3970e`)">
                    <NumberInput v-model="minimumMembers" :required="false" :placeholder="$t(`57ee093f-d5f8-40f5-a991-53ff348c7376`)" />
                </STInputBox>

                <STInputBox error-fields="settings.maxAge" :error-box="errors.errorBox" :title="$t(`74797680-f43e-49dc-ba7e-c60990a76946`)">
                    <NumberInput v-model="maximumMembers" :required="false" :placeholder="$t(`f5f56168-1922-4a23-b376-20a7738bfa66`)" />
                </STInputBox>
            </div>
        </template>

        <JumpToContainer :visible="organizationTagIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('edfc89fe-a16e-4789-bda9-1529f8a97f7c') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="organizationTagIds = null" />
                </div>
            </h2>
            <p>{{ $t('c2f17e85-ff68-46fc-9410-6fb6c8a6843f') }}</p>

            <TagIdsInput v-model="organizationTagIds" :validator="errors.validator" />
        </JumpToContainer>

        <JumpToContainer :visible="defaultAgeGroupIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('5271f407-ec58-4802-ac69-7f357bc3cfc7') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="defaultAgeGroupIds = null" />
                </div>
            </h2>

            <p>{{ $t('9b1dac9d-57f9-4589-aa9c-6d97be960bef') }}</p>

            <DefaultAgeGroupIdsInput v-model="defaultAgeGroupIds" :validator="errors.validator" :should-select-at-least-one="true" />

            <hr><h2>{{ $t('39fa6554-b6bd-4885-adcc-33b6a037b2c3') }}</h2>

            <p>{{ $t('022aad3d-6250-4000-9336-4ae7e8e75c23') }}</p>

            <STList>
                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.None" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('45ff02db-f404-4d91-853f-738d55c40cb6') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Read" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('7afc105f-d34d-4b93-9b33-a6cc08c818ee') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Write" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('d70ee185-cd15-4800-97a0-3de05d6db151') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Full" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('c2296305-99a9-497a-aed3-7bb3d2293ce8') }}
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
                            {{ $t('4b7c05e2-de83-4cb4-9438-3fd74181ee6f') }}
                        </h3>
                    </STListItem>

                    <STListItem v-if="defaultAgeGroupIds === null && organizationBased" :selectable="true" element-name="button" @click="defaultAgeGroupIds = []">
                        <template #left>
                            <span class="icon add gray" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('789d73f7-1db6-4f78-8042-93344495f9b2') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('671cfb26-2018-4186-aa06-f167102db2b1') }}
                        </p>
                    </STListItem>
                </template>

                <STListItem :selectable="true" element-name="button" @click="editPermissions">
                    <template #left>
                        <span class="icon privacy gray" />
                    </template>

                    <h3 v-if="!permissions" class="style-title-list">
                        {{ $t('1403efde-6581-4447-b77d-95bf1307b6e2') }}
                    </h3>
                    <h3 v-else class="style-title-list">
                        {{ $t('4524e0f6-e1a7-4130-b5aa-d6b08a4ae517') }}
                    </h3>

                    <p v-if="organizationBased" class="style-description-small">
                        {{ $t('b1d424aa-4d55-48f7-80c1-d6d4b5708f07') }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('9f5646d9-5526-4c3c-9a47-858374749d8e') }}
                    </p>
                </STListItem>
            </STList>
        </template>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr><h2>
                {{ $t('1e83f389-222b-48c7-ab9f-c77f82ea05af') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('838cae8b-92a5-43d2-82ba-01b8e830054b') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DefaultAgeGroupIdsInput, EditRoleView, ErrorBox, JumpToContainer, NumberInput, SaveView, TagIdsInput, useAppContext, useErrors, usePatch } from '@stamhoofd/components';
import { MemberResponsibility, PermissionLevel, PermissionRoleForResponsibility } from '@stamhoofd/structures';
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
const title = computed(() => props.isNew ? $t('7540c9f1-2164-4865-a6c5-ad72e0abd4e5') : $t('2e9f8eb3-806a-4037-bd01-f381a725956b'));
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
                message: $t('9aa8ff59-33ae-4ac4-93b6-97e071b13012'),
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

    if (!await CenteredMessage.confirm($t('8f155af7-52ce-441f-bd3c-669bda1450eb'), $t('838cae8b-92a5-43d2-82ba-01b8e830054b'), $t('78085d8c-9987-4eda-a747-7f7847d86dc4'))) {
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

    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>

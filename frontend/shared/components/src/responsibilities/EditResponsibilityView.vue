<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox :title="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') ">
            <input v-model="name" class="input" type="text" :placeholder="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') "></STInputBox>

        <STInputBox :title="$t('1c338881-0940-429b-a47e-7c9d3055f533')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('3db64326-c892-4fdb-8293-3d713453383a')" autocomplete="off"/>
        </STInputBox>

        <Checkbox v-if="app === 'admin'" v-model="notOrganizationBased">
            {{ $t('4557997b-e213-489a-87d3-b71bdcecaca8') }}
        </Checkbox>

        <template v-if="organizationBased && app === 'admin'">
            <hr><h2>{{ $t('18ccf28f-7c70-49b9-bbf7-5598d52ed83e') }}</h2>

            <div class="split-inputs">
                <STInputBox error-fields="settings.minAge" :error-box="errors.errorBox" :title="$t(`51eaab35-e8a1-4b36-a589-0ef18a657ce7`)">
                    <NumberInput v-model="minimumMembers" :required="false" :placeholder="$t(`Geen`)"/>
                </STInputBox>

                <STInputBox error-fields="settings.maxAge" :error-box="errors.errorBox" :title="$t(`c4e0a117-780f-4e60-80ec-a33b19294445`)">
                    <NumberInput v-model="maximumMembers" :required="false" :placeholder="$t(`948ef7e2-171d-4e02-89ce-ea3de1ab7e06`)"/>
                </STInputBox>
            </div>
        </template>

        <JumpToContainer :visible="organizationTagIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('c5bd564e-223a-4f7d-acfd-a93956d7b346') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="organizationTagIds = null"/>
                </div>
            </h2>
            <p>{{ $t('3ada8b2f-bf98-469d-b50d-a1da080764d0') }}</p>

            <TagIdsInput v-model="organizationTagIds" :validator="errors.validator"/>
        </JumpToContainer>

        <JumpToContainer :visible="defaultAgeGroupIds !== null">
            <hr><h2 class="style-with-button">
                <div>{{ $t('a6d28ccc-8da6-4ad3-9854-95e27f76cef6') }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="defaultAgeGroupIds = null"/>
                </div>
            </h2>

            <p>{{ $t('4a72cf22-28ec-43bb-b5b7-045bc737ca04') }}</p>

            <DefaultAgeGroupIdsInput v-model="defaultAgeGroupIds" :validator="errors.validator" :should-select-at-least-one="true"/>

            <hr><h2>{{ $t('f91b3a38-a3c9-400e-8a7b-9f3124cc2f67') }}</h2>

            <p>{{ $t('022aad3d-6250-4000-9336-4ae7e8e75c23') }}</p>

            <STList>
                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.None"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('039ea891-15aa-42d4-8513-7f29d0743514') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Read"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('a6f97ac1-29f0-4734-a133-b69bb1ef9f00') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Write"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('aec9e050-cfbc-4c7e-ae52-7bf77b1532f8') }}
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Full"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('0748bf05-edf7-4787-a751-9e371dad19cc') }}
                    </h3>
                </STListItem>
            </STList>
        </JumpToContainer>

        <template v-if="organizationTagIds === null || defaultAgeGroupIds === null">
            <hr><STList>
                <template v-if="app === 'admin'">
                    <STListItem v-if="organizationTagIds === null && organizationBased" :selectable="true" element-name="button" @click="organizationTagIds = []">
                        <template #left>
                            <span class="icon add gray"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('e744b5ba-e462-4c18-8a73-ccebd7000814') }}
                        </h3>
                    </STListItem>

                    <STListItem v-if="defaultAgeGroupIds === null && organizationBased" :selectable="true" element-name="button" @click="defaultAgeGroupIds = []">
                        <template #left>
                            <span class="icon add gray"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('5176ca6b-5952-42ad-8c91-82e3634fe72f') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('54a468e1-5a5a-41f5-8e77-2b3bfbccf33c') }}
                        </p>
                    </STListItem>
                </template>

                <STListItem :selectable="true" element-name="button" @click="editPermissions">
                    <template #left>
                        <span class="icon privacy gray"/>
                    </template>

                    <h3 v-if="!permissions" class="style-title-list">
                        {{ $t('b304d4cd-b2b8-49a9-a0fd-96c3ad6ef354') }}
                    </h3>
                    <h3 v-else class="style-title-list">
                        {{ $t('4d5c7044-3d03-4167-9c06-7008b71c2703') }}
                    </h3>

                    <p v-if="organizationBased" class="style-description-small">
                        {{ $t('f783e5c3-1ceb-45f6-ac20-0addad36ceca') }}
                    </p>
                    <p v-else class="style-description-small">
                        {{ $t('18cb1ac2-87d3-439a-a909-f4f84d7fc975') }}
                    </p>
                </STListItem>
            </STList>
        </template>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr><h2>
                {{ $t('1e83f389-222b-48c7-ab9f-c77f82ea05af') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash"/>
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
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberResponsibility, PermissionLevel, PermissionRoleForResponsibility } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
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

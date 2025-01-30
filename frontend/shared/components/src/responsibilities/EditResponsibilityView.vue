<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') ">
            <input
                v-model="name"
                class="input"
                type="text"
                :placeholder="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') "
            >
        </STInputBox>

        <STInputBox :title="$t('1c338881-0940-429b-a47e-7c9d3055f533')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                :placeholder="$t('3db64326-c892-4fdb-8293-3d713453383a')"
                autocomplete=""
            />
        </STInputBox>

        <Checkbox v-if="app === 'admin'" v-model="notOrganizationBased">
            Nationale functie
        </Checkbox>

        <template v-if="organizationBased && app === 'admin'">
            <hr>
            <h2>Vereisten</h2>

            <div class="split-inputs">
                <STInputBox title="Minimum aantal (optioneel)" error-fields="settings.minAge" :error-box="errors.errorBox">
                    <NumberInput v-model="minimumMembers" placeholder="Geen" :required="false" />
                </STInputBox>

                <STInputBox title="Maximum aantal (optioneel)" error-fields="settings.maxAge" :error-box="errors.errorBox">
                    <NumberInput v-model="maximumMembers" placeholder="Onbeperkt" :required="false" />
                </STInputBox>
            </div>
        </template>

        <JumpToContainer :visible="organizationTagIds !== null">
            <hr>

            <h2 class="style-with-button">
                <div>Groepen</div>
                <div>
                    <button type="button" class="button icon trash" @click="organizationTagIds = null" />
                </div>
            </h2>
            <p>Kies voor welke lokale groepen deze functie beschikbaar is.</p>

            <TagIdsInput v-model="organizationTagIds" :validator="errors.validator"/>
        </JumpToContainer>

        <JumpToContainer :visible="defaultAgeGroupIds !== null">
            <hr>

            <h2 class="style-with-button">
                <div>Leeftijdsgroepen</div>
                <div>
                    <button type="button" class="button icon trash" @click="defaultAgeGroupIds = null" />
                </div>
            </h2>

            <p>Deze functie moet gekoppeld worden aan een specifieke inschrijvingsgroep van een lokale groep. Hier kan je die lokale leeftijdsgroepen beperken tot een aantal standaard leeftijdsgroepen.</p>

            <DefaultAgeGroupIdsInput v-model="defaultAgeGroupIds" :validator="errors.validator" :should-select-at-least-one="true" />

            <hr>

            <h2>Automatische rechten voor gekoppelde leeftijdsgroep</h2>

            <p>{{ $t('022aad3d-6250-4000-9336-4ae7e8e75c23') }}</p>

            <STList>
                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.None" />
                    </template>
                    <h3 class="style-title-list">
                        Geen
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Read" />
                    </template>
                    <h3 class="style-title-list">
                        Lezen
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Write" />
                    </template>
                    <h3 class="style-title-list">
                        Lezen en bewerken
                    </h3>
                </STListItem>

                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="groupPermissionLevel" :value="PermissionLevel.Full" />
                    </template>
                    <h3 class="style-title-list">
                        Volledige toegang
                    </h3>
                </STListItem>
            </STList>
        </JumpToContainer>

        <template v-if="organizationTagIds === null || defaultAgeGroupIds === null">
            <hr>

            <STList>
                <template v-if="app === 'admin'">
                    <STListItem v-if="organizationTagIds === null && organizationBased" :selectable="true" element-name="button" @click="organizationTagIds = []">
                        <template #left>
                            <span class="icon add gray" />
                        </template>

                        <h3 class="style-title-list">
                            Beperk tot bepaalde lokale groepen (tags)
                        </h3>
                    </STListItem>

                    <STListItem v-if="defaultAgeGroupIds === null && organizationBased" :selectable="true" element-name="button" @click="defaultAgeGroupIds = []">
                        <template #left>
                            <span class="icon add gray" />
                        </template>

                        <h3 class="style-title-list">
                            Koppel de functie aan leeftijdsgroepen
                        </h3>

                        <p class="style-description-small">
                            De functie moet dan worden toegekend aan een specifieke inschrijvingsgroep
                        </p>
                    </STListItem>
                </template>

                <STListItem :selectable="true" element-name="button" @click="editPermissions">
                    <template #left>
                        <span class="icon privacy gray" />
                    </template>

                    <h3 v-if="!permissions" class="style-title-list">
                        Automatisch rechten toekennen
                    </h3>
                    <h3 v-else class="style-title-list">
                        Gekoppelde rechten aanpassen
                    </h3>

                    <p v-if="organizationBased" class="style-description-small">
                        Stel in welke rechten deze leden automatisch krijgen tot het beheerderportaal
                    </p>
                    <p v-else class="style-description-small">
                        Stel in welke rechten deze leden automatisch krijgen tot het administratieportaal
                    </p>
                </STListItem>
            </STList>
        </template>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
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

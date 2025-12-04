<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`cbe7db4a-b65b-452b-a5d2-d369182fd28f`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`3446a6ac-5bda-4564-a268-5c7a66d74ff9`)">
        </STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`8d767b75-7a76-4cb7-b4b1-36d596f1848c`)" />
        </STInputBox>
        <div class="container">
            <hr><h2>{{ $t('b381ed6f-c509-418d-9668-7c161a0fa652') }}</h2>
            <p class="style-description">
                {{ $t('4139ef30-55c8-4775-b97a-69b3a8b7d112') }}
            </p>
            <STList v-model="draggableChildTags" :draggable="true">
                <template #item="{item}">
                    <TagRow :all-tags="allPatchedTags" :tag="item" @click="editTag(item)" @patch:all-tags="addArrayPatch" />
                </template>
            </STList>
            <p>
                <button class="button text" type="button" @click="addTag">
                    <span class="icon add" />
                    <span>{{ $t('20699886-7112-43f5-b38c-f5b686c37257') }}</span>
                </button>
            </p>
        </div>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('e5c15476-6092-45c9-ac55-541f45720c71') }}
            </h2>
            <p v-if="!isEmpty" class="style-description">
                {{ $t('ceaaf7f7-900e-497e-91f5-16c3a173b7bf') }}
            </p>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('5bb7b4d5-def0-431d-ba3c-e34ffc7ee777') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SaveView, useDraggableArrayIds, useErrors } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { getOrganizationTagTypeName, OrganizationTag } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, Ref } from 'vue';
import TagRow from './components/TagRow.vue';
import EditOrganizationTagView from './EditOrganizationTagView.vue';

const errors = useErrors();
const present = usePresent();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    tag: OrganizationTag;
    allTags: OrganizationTag[];
    isNew: boolean;
    saveHandler: (patch: PatchableArrayAutoEncoder<OrganizationTag>) => Promise<void>;
}>();

const title = computed(() => props.isNew ? $t(`969ae056-dd8b-49ba-aeb5-ca810c65f599`) : Formatter.capitalizeFirstLetter($t('cd52133a-d8bf-4dde-a924-962f3f0e3fe9', { tagType: getOrganizationTagTypeName(props.tag.type) })));
const pop = usePop();

const patch = ref(new PatchableArray()) as Ref<PatchableArrayAutoEncoder<OrganizationTag>>;
if (props.isNew) {
    patch.value.addPut(props.tag);
}

const allPatchedTags = computed(() => patch.value.applyTo(props.allTags) as OrganizationTag[]);
const patched = computed(() => getPatchedTag(props.tag.id) ?? OrganizationTag.create({ name: $t(`6748967b-c512-454f-9d30-a1a42e2814bc`) }));

const hasChanges = computed(() => patch.value.changes.length > 0);

function addPatch(newPatch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationTag>>) {
    patch.value.addPatch((props.tag.static as typeof OrganizationTag).patch({ id: props.tag.id, ...newPatch }));
}

function addArrayPatch(newPatch: PatchableArrayAutoEncoder<OrganizationTag>) {
    patch.value = patch.value.patch(newPatch);
}

function addDelete(id: string) {
    patch.value.addDelete(id);
}

const isEmpty = computed(() => patched.value.childTags.length === 0);
const draggableChildTags = useDraggableArrayIds(
    () => patched.value.childTags.map(id => allPatchedTags.value.find(patchedTag => patchedTag.id === id)).filter(x => x !== undefined),
    patch => addPatch({ childTags: patch }),
);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (name.value.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`f1755667-e6d5-4532-95a9-019c04c509bc`),
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

    if (!await CenteredMessage.confirm($t(`c05ea3d6-e656-4ede-a87e-7f46b0598663`), $t(`63af93aa-df6a-4937-bce8-9e799ff5aebd`))) {
        return;
    }

    deleting.value = true;

    try {
        addDeleteRecursive(props.tag.id);
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

function addDeleteRecursive(tagId: string) {
    const tag = getPatchedTag(tagId);

    if (tag) {
        for (const childTagId of tag.childTags) {
            addDeleteRecursive(childTagId);
        }

        addDelete(tagId);
    }
}

function getPatchedTag(tagId: string): OrganizationTag | undefined {
    return allPatchedTags.value.find(t => t.id === tagId);
}

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const description = computed({
    get: () => patched.value.description,
    set: description => addPatch({ description }),
});

async function editTag(tag: OrganizationTag) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationTagView, {
                allTags: allPatchedTags.value,
                tag,
                isNew: false,
                saveHandler: (newPatch: PatchableArrayAutoEncoder<OrganizationTag>) => {
                    patch.value = patch.value.patch(newPatch);
                },
            }),
        ],
    });
}

async function addTag() {
    const tag = OrganizationTag.create({});

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditOrganizationTagView, {
                allTags: allPatchedTags.value,
                tag,
                isNew: true,
                saveHandler: (newPatch: PatchableArrayAutoEncoder<OrganizationTag>) => {
                    patch.value = patch.value.patch(newPatch);

                    const recordsPatch = new PatchableArray<string, string, string>();
                    recordsPatch.addPut(tag.id);

                    addPatch({ childTags: recordsPatch });
                },
            }),
        ],
    });
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t(`4f0d330f-f2d2-4fbf-a4b4-267d939db1ee`), $t(`335dc08b-97e1-4f01-9356-b47f741225e4`));
};

defineExpose({
    shouldNavigateAway,
});
</script>

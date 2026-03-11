<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%vC`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%H4`)">
        </STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`%6o`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`%H5`)" />
        </STInputBox>
        <div class="container">
            <hr><h2>{{ $t('%6y') }}</h2>
            <p class="style-description">
                {{ $t('%6z') }}
            </p>
            <STList v-model="draggableChildTags" :draggable="true">
                <template #item="{item}">
                    <TagRow :all-tags="allPatchedTags" :tag="item" @click="editTag(item)" @patch:all-tags="addArrayPatch" />
                </template>
            </STList>
            <p>
                <button class="button text" type="button" @click="addTag">
                    <span class="icon add" />
                    <span>{{ $t('%70') }}</span>
                </button>
            </p>
        </div>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%71') }}
            </h2>
            <p v-if="!isEmpty" class="style-description">
                {{ $t('%72') }}
            </p>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
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

const title = computed(() => props.isNew ? $t(`%H6`) : Formatter.capitalizeFirstLetter($t('%7Y', { tagType: getOrganizationTagTypeName(props.tag.type) })));
const pop = usePop();

const patch = ref(new PatchableArray()) as Ref<PatchableArrayAutoEncoder<OrganizationTag>>;
if (props.isNew) {
    patch.value.addPut(props.tag);
}

const allPatchedTags = computed(() => patch.value.applyTo(props.allTags) as OrganizationTag[]);
const patched = computed(() => getPatchedTag(props.tag.id) ?? OrganizationTag.create({ name: $t(`%Gp`) }));

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
                message: $t(`%56`),
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

    if (!await CenteredMessage.confirm($t(`%H7`), $t(`%CJ`))) {
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
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
};

defineExpose({
    shouldNavigateAway,
});
</script>

<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ tag.name }}
        </h2>
        <p v-if="childTagCount > 0" class="style-description-small">
            {{ capitalizeFirstLetter(pluralText(childTagCount, getOrganizationTagTypeName(childType), getOrganizationTagTypePluralName(childType))) }}
        </p>
        <p v-if="tag.description" class="style-description-small pre-wrap style-limit-lines" v-text="tag.description" />

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ContextMenu, ContextMenuItem, useEmitPatchArray } from '@stamhoofd/components';
import { getOrganizationTagTypeName, getOrganizationTagTypePluralName, OrganizationTag, TagHelper } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    tag: OrganizationTag;
    allTags: OrganizationTag[];
}>();
const emit = defineEmits(['patch:allTags']);

const childTagCount = computed(() => props.tag.childTags.length);
const childType = computed(() => props.tag.getChildType(props.allTags));
const filteredTags = computed(() => props.allTags.filter(t => t.id !== props.tag.id && !TagHelper.containsDeep(props.tag.id, t.id, { allTags: props.allTags })));
const { addArrayPatch } = useEmitPatchArray<typeof props, 'allTags', OrganizationTag>(props, emit, 'allTags');

function contextMenuForTag(t: OrganizationTag, action: (tag: OrganizationTag) => void): ContextMenuItem {
    const children = t.childTags.map(tt => filteredTags.value.find(ft => ft.id === tt)).filter(tt => !!tt);
    return new ContextMenuItem({
        name: t.name,
        childMenu: children.length
            ? new ContextMenu([
                [
                    new ContextMenuItem({
                        name: t.name,
                        action: () => {
                            action(t);
                        },
                    }),
                ],
                children.map(ttt => contextMenuForTag(ttt, action)),
            ])
            : undefined,
        action: () => {
            action(t);
        },
    });
}

function showContextMenu(event: MouseEvent) {
    const parentTags = props.allTags.filter(t => t.childTags.includes(props.tag.id));

    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`507c48cb-35ae-4c94-bc7a-4611360409c8`),
                childMenu: new ContextMenu([
                    ...(
                        parentTags.length > 0
                            ? [
                                    [
                                        new ContextMenuItem({
                                            name: $t(`b84fbf5b-58f6-4840-a0f1-977823fbe523`),
                                            action: () => {
                                                // Remove self from all these parent tags
                                                const patch: PatchableArrayAutoEncoder<OrganizationTag> = new PatchableArray();
                                                for (const parentTag of parentTags) {
                                                    const p = OrganizationTag.patch({
                                                        id: parentTag.id,
                                                    });
                                                    p.childTags.addDelete(props.tag.id);
                                                    patch.addPatch(p);
                                                }

                                                addArrayPatch(patch);
                                            },
                                        }),
                                    ],
                                ]
                            : []
                    ),
                    TagHelper.getRootTags(filteredTags.value).map(t => contextMenuForTag(t, (moveToTag) => {
                        // Remove self from all these parent tags
                        const patch: PatchableArrayAutoEncoder<OrganizationTag> = new PatchableArray();
                        for (const parentTag of parentTags) {
                            const p = OrganizationTag.patch({
                                id: parentTag.id,
                            });
                            p.childTags.addDelete(props.tag.id);
                            patch.addPatch(p);
                        }

                        const p = OrganizationTag.patch({
                            id: moveToTag.id,
                        });
                        p.childTags.addPut(props.tag.id);
                        patch.addPatch(p);

                        addArrayPatch(patch);
                    })),
                ]),
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

</script>

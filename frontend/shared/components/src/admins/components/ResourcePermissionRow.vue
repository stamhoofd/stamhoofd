<template>
    <STListItem element-name="label" :selectable="true" class="left-center">
        <template #left>
            <Checkbox v-model="selected" :disabled="locked" />
        </template>
        <template v-if="type === 'resource'">
            <h2 class="style-title-list">
                {{ resource.name || $t('55f226d4-6147-4af7-9dc9-f3b55d4e506a') }}
            </h2>
            <p v-if="resource.description" class="style-description-small">
                {{ resource.description }}
            </p>
            <p v-if="isEditingUserPermissions" class="style-description-small">
                {{ capitalizeFirstLetter(getPermissionResourceTypeName(resource.type, false)) }}
            </p>
        </template>
        <template v-else>
            <h2 v-if="role instanceof PermissionRoleDetailed" class="style-title-list">
                {{ role.name }}
            </h2>
            <p v-if="isMe" class="style-description-small">
                {{ $t('703dec5e-fc37-4ab5-aaa8-4b7d0ed5589a') }}
            </p>
        </template>

        <p v-if="unlisted" class="style-description-small">
            {{ $t('3977f1e7-abb1-4876-90b4-02ecc45c2b31') }}
        </p>

        <template #right>
            <div v-if="selected">
                <button class="button text" type="button" @click.stop.prevent="choosePermissions($event)">
                    <span>{{ levelText }}</span>
                    <span class="icon arrow-down-small" />
                </button>
            </div>
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { ContextMenu, ContextMenuItem, useAuth, useEmitPatch } from '@stamhoofd/components';
import { AccessRight, AccessRightHelper, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, getPermissionLevelName, getPermissionLevelNumber, getPermissionResourceTypeName, maximumPermissionlevel } from '@stamhoofd/structures';
import { Ref, computed } from 'vue';

const props = withDefaults(defineProps<{
    resource: { id: string; name: string; type: PermissionsResourceType; description?: string };
    role: PermissionRoleDetailed | Permissions;
    inheritedRoles?: (PermissionRoleDetailed | Permissions)[];
    type: 'resource' | 'role'; // whether we show the name of the role or the resource
    configurableAccessRights: AccessRight[];
    unlisted?: boolean;
}>(), {
    inheritedRoles: () => [],
    unlisted: false,
});

const emit = defineEmits(['patch:role']);
const { patched: role, addPatch, createPatch } = useEmitPatch<PermissionRoleDetailed | Permissions>(props, emit, 'role');
const auth = useAuth();
const isEditingUserPermissions = (role.value instanceof Permissions);

const isMe = computed(() => {
    if (role.value instanceof Permissions) {
        return false;
    }
    const realRole = role.value;
    return !!auth.unloadedPermissions?.roles.find(r => r.id === realRole.id);
});

const resourcePermissions = computed(() => role.value.resources.get(props.resource.type)?.get(props.resource.id));

const lockedMinimumLevel = computed(() => {
    const a = props.role.level;
    const b = props.resource.id !== '' ? (role.value.resources.get(props.resource.type)?.get('')?.level ?? PermissionLevel.None) : PermissionLevel.None;

    const arr = [a, b];

    for (const role of props.inheritedRoles) {
        const c = role.level;
        const d = role.resources.get(props.resource.type)?.get('')?.level ?? PermissionLevel.None;
        const e = props.resource.id !== '' ? (role.resources.get(props.resource.type)?.get(props.resource.id)?.level ?? PermissionLevel.None) : PermissionLevel.None;
        arr.push(c, d, e);
    }

    return maximumPermissionlevel(...arr);
});

const lockedAccessRights = computed(() => {
    const accessRights = props.resource.id !== '' ? (role.value.resources.get(props.resource.type)?.get('')?.accessRights ?? []) : [];
    return accessRights;
});

const permissionLevel = computed({
    get: () => {
        const base = resourcePermissions.value?.level ?? PermissionLevel.None;
        const inherited = lockedMinimumLevel.value;

        if (getPermissionLevelNumber(base) < getPermissionLevelNumber(inherited)) {
            return inherited;
        }

        return base;
    },
    set: (level: PermissionLevel) => {
        if (permissionLevel.value === level) {
            return;
        }

        if (getPermissionLevelNumber(level) < getPermissionLevelNumber(lockedMinimumLevel.value)) {
            return;
        }

        const patch = createPatch();
        if (level === PermissionLevel.None) {
            // Delete the resource if no access rights
            if (resourcePermissions.value?.accessRights.length) {
                // Keep it but set the level
            }
            else {
                // Delete it
                const subPatch = new PatchMap<string, AutoEncoderPatchType<ResourcePermissions> | ResourcePermissions | null>();
                subPatch.set(props.resource.id, null);
                patch.resources!.set(props.resource.type, subPatch);
                addPatch(patch);
                return;
            }
        }

        const subPatch = new PatchMap<string, AutoEncoderPatchType<ResourcePermissions> | ResourcePermissions | null>();

        if (resourcePermissions.value) {
            subPatch.set(props.resource.id, ResourcePermissions.patch({
                resourceName: props.resource.name,
                level,
            }));
        }
        else {
            subPatch.set(props.resource.id, ResourcePermissions.create({
                resourceName: props.resource.name,
                level,
            }));
        }

        patch.resources!.set(props.resource.type, subPatch);
        addPatch(patch);
    },
});

const accessRightsMap: Map<AccessRight, Ref<boolean>> = new Map();

for (const accessRight of props.configurableAccessRights) {
    const hasAccessRight = computed({
        get: () => resourcePermissions?.value?.accessRights?.includes(accessRight) ?? false,
        set: (enable: boolean) => {
            if (hasAccessRight.value === enable) {
                return;
            }

            const subPatch = new PatchMap<string, AutoEncoderPatchType<ResourcePermissions> | ResourcePermissions | null>();

            if (resourcePermissions.value) {
                const p = ResourcePermissions.patch({
                    resourceName: props.resource.name,
                });
                if (enable) {
                    p.accessRights.addDelete(accessRight); // prevent creating duplicates
                    p.accessRights.addPut(accessRight);
                }
                else {
                    p.accessRights.addDelete(accessRight);
                    p.accessRights.addDelete(accessRight); // auto correct duplicates
                }
                subPatch.set(props.resource.id, p);
            }
            else {
                subPatch.set(props.resource.id, ResourcePermissions.create({
                    resourceName: props.resource.name,
                    level: PermissionLevel.None,
                    accessRights: [accessRight],
                }));
            }

            const patch = createPatch();
            patch.resources!.set(props.resource.type, subPatch);
            addPatch(patch);
        },
    });
    accessRightsMap.set(accessRight, hasAccessRight);
}

const locked = computed(() => {
    return lockedMinimumLevel.value !== PermissionLevel.None || lockedAccessRights.value.length > 0;
});

const selected = computed({
    get: () => lockedMinimumLevel.value !== PermissionLevel.None || lockedAccessRights.value.length > 0 || (!!resourcePermissions.value && (resourcePermissions.value.level !== PermissionLevel.None || !!resourcePermissions.value?.accessRights.length)),
    set: (value: boolean) => {
        if (value === selected.value) {
            return;
        }
        if (locked.value) {
            return;
        }

        if (value) {
            permissionLevel.value = PermissionLevel.Read;
        }
        else {
            // Delete it
            const patch = createPatch();
            const subPatch = new PatchMap<string, AutoEncoderPatchType<ResourcePermissions> | ResourcePermissions | null>();
            subPatch.set(props.resource.id, null);
            patch.resources!.set(props.resource.type, subPatch);
            addPatch(patch);
        }
    },
});

const allAccessRights = computed(() => {
    const specificAccessRights = resourcePermissions.value?.accessRights ?? [];
    const inheritedAccessRights = lockedAccessRights.value;
    return [...new Set([...specificAccessRights, ...inheritedAccessRights])];
});

const levelText = computed(() => {
    switch (permissionLevel.value) {
        case PermissionLevel.None: {
            // Loop over all access rights
            const accessRights = allAccessRights.value;
            if (accessRights.length) {
                return accessRights.map(r => AccessRightHelper.getNameShort(r)).join(' + ');
            }
            return $t(`5c7bd1da-78a7-428c-9c93-2be66c44ff6c`);
        }
        case PermissionLevel.Read: {
            const rights = [$t(`e80f2233-257d-45df-a04e-af7e5f694546`)];
            const accessRights = allAccessRights.value;

            for (const right of accessRights) {
                const base = AccessRightHelper.autoGrantRightForLevel(right);
                if (!base || getPermissionLevelNumber(base) > getPermissionLevelNumber(PermissionLevel.Read)) {
                    // This is not automatically granted for read permissions
                    rights.push(AccessRightHelper.getNameShort(right));
                }
            }

            return rights.join(' + ');
        }
        case PermissionLevel.Write: {
            const rights = [$t(`194b293f-79ca-4ad9-820d-91f0ada966ad`)];
            const accessRights = allAccessRights.value;

            for (const right of accessRights) {
                const base = AccessRightHelper.autoGrantRightForLevel(right);
                if (!base || getPermissionLevelNumber(base) > getPermissionLevelNumber(PermissionLevel.Write)) {
                    // This is not automatically granted for read permissions
                    rights.push(AccessRightHelper.getNameShort(right));
                }
            }

            return rights.join(' + ');
        }
        case PermissionLevel.Full: {
            const rights = [$t(`b182a5e2-aae7-48ae-bb42-c51edfb5df29`)];
            const accessRights = allAccessRights.value;

            for (const right of accessRights) {
                const base = AccessRightHelper.autoGrantRightForLevel(right);
                if (!base || getPermissionLevelNumber(base) > getPermissionLevelNumber(PermissionLevel.Full)) {
                    // This is not automatically granted for read permissions
                    rights.push(AccessRightHelper.getNameShort(right));
                }
            }

            return rights.join(' + ');
        }
        default: {
            const _exhaustiveCheck: never = permissionLevel.value;
            return _exhaustiveCheck;
        }
    }
});

const choosePermissions = async (event: MouseEvent) => {
    const showAccessRights = props.configurableAccessRights;
    const contextMenu = new ContextMenu([
        // Base levels
        [
            new ContextMenuItem({
                selected: permissionLevel.value === PermissionLevel.None,
                name: $t(`dc1ffb07-49de-475c-9d96-6940d0cbbc09`),
                disabled: getPermissionLevelNumber(PermissionLevel.None) < getPermissionLevelNumber(lockedMinimumLevel.value),
                action: () => {
                    permissionLevel.value = PermissionLevel.None;
                },
            }),
            new ContextMenuItem({
                selected: permissionLevel.value === PermissionLevel.Read,
                name: $t(`e80f2233-257d-45df-a04e-af7e5f694546`),
                disabled: getPermissionLevelNumber(PermissionLevel.Read) < getPermissionLevelNumber(lockedMinimumLevel.value),
                action: () => {
                    permissionLevel.value = PermissionLevel.Read;
                },
            }),
            new ContextMenuItem({
                selected: permissionLevel.value === PermissionLevel.Write,
                name: $t(`194b293f-79ca-4ad9-820d-91f0ada966ad`),
                disabled: getPermissionLevelNumber(PermissionLevel.Write) < getPermissionLevelNumber(lockedMinimumLevel.value),
                action: () => {
                    permissionLevel.value = PermissionLevel.Write;
                },
            }),
            new ContextMenuItem({
                selected: permissionLevel.value === PermissionLevel.Full,
                disabled: getPermissionLevelNumber(PermissionLevel.Full) < getPermissionLevelNumber(lockedMinimumLevel.value),
                name: $t(`b182a5e2-aae7-48ae-bb42-c51edfb5df29`),
                action: () => {
                    permissionLevel.value = PermissionLevel.Full;
                },
            }),
        ],
        // Access rights
        ...(showAccessRights.length > 0
            ? [
                    showAccessRights.map((accessRight) => {
                        const baseLevel = AccessRightHelper.autoGrantRightForLevel(accessRight);
                        const isLocked = lockedAccessRights.value.includes(accessRight);
                        const included = !!baseLevel && getPermissionLevelNumber(permissionLevel.value) >= getPermissionLevelNumber(baseLevel);

                        let description: string|undefined = undefined;
                        if (!isLocked) {
                            if (included) {
                                description = ($t(`c3d22dca-87b6-4975-96ff-72ffe2ce99d0`) + ' ' + getPermissionLevelName(baseLevel));
                            }
                            else {
                                description = ($t(`74dd7a35-db8b-477d-934a-2681d8d35184`) + ' ' + getPermissionLevelName(permissionLevel.value));
                            }
                        }

                        return new ContextMenuItem({
                            selected: isLocked || included || accessRightsMap.get(accessRight)!.value,
                            name: AccessRightHelper.getName(accessRight),
                            disabled: isLocked || included,
                            description,
                            action: () => {
                                accessRightsMap.get(accessRight)!.value = !accessRightsMap.get(accessRight)!.value;
                            },
                        });
                    }),
                ]
            : []),
    ]);

    await contextMenu.show({
        button: event.currentTarget as HTMLElement,
        xPlacement: 'left',
        yPlacement: 'bottom',
    });
};
</script>

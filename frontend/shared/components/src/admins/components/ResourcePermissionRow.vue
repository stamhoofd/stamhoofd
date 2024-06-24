<template>
    <STListItem element-name="label" :selectable="true">
        <template #left>
            <Checkbox v-model="selected" :disabled="locked" />
        </template>
        <template v-if="type === 'resource'">
            <h2 class="style-title-list">
                {{ resource.name }}
            </h2>
            <p v-if="isEditingUserPermissions" class="style-description-small">
                {{ capitalizeFirstLetter(getPermissionResourceTypeName(resource.type, false)) }}
            </p>
        </template>
        <template v-else>
            <h2 class="style-title-list">
                {{ role.name }}
            </h2>
            <p v-if="isMe" class="style-description-small">
                Jij zit in deze groep
            </p>
        </template>

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
import { AccessRight, AccessRightHelper, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, getPermissionLevelName, getPermissionLevelNumber, getPermissionResourceTypeName } from '@stamhoofd/structures';
import { Ref, computed } from 'vue';

const props = defineProps<{
    resource: {id: string, name: string, type: PermissionsResourceType};
    role: PermissionRoleDetailed|Permissions;
    type: 'resource' | 'role'; // whether we show the name of the role or the resource
    configurableAccessRights: AccessRight[];
}>();


const emit = defineEmits(['patch:role'])
const {patched: role, addPatch, createPatch} = useEmitPatch<PermissionRoleDetailed|Permissions>(props, emit, 'role');
const auth = useAuth()
const isEditingUserPermissions = (role.value instanceof Permissions);

const isMe = computed(() => {
    if (role.value instanceof Permissions) {
        return false
    }
    const realRole = role.value
    return !!auth.permissions?.roles.find(r => r.id === realRole.id)
})

const resourcePermissions = computed(() => role.value.resources.get(props.resource.type)?.get(props.resource.id))

const lockedMinimumLevel = computed(() => {
    const a = props.role.level
    const b = props.resource.id !== '' ? (role.value.resources.get(props.resource.type)?.get('')?.level ?? PermissionLevel.None) : PermissionLevel.None

    if (getPermissionLevelNumber(a) > getPermissionLevelNumber(b)) {
        return a
    }
    return b
})

const permissionLevel = computed({
    get: () => {
        const base = resourcePermissions.value?.level ?? PermissionLevel.None
        const inherited = lockedMinimumLevel.value

        if (getPermissionLevelNumber(base) < getPermissionLevelNumber(inherited)) {
            return inherited
        }

        return base;
    },
    set: (level: PermissionLevel) => {
        if (permissionLevel.value === level) {
            return
        }

        if (getPermissionLevelNumber(level) < getPermissionLevelNumber(lockedMinimumLevel.value)) {
            return
        }

        const patch = createPatch()
        if (level == PermissionLevel.None) {
            // Delete the resource if no access rights
            if (resourcePermissions.value?.accessRights.length) {
                // Keep it but set the level
            } else {
                // Delete it
                const subPatch = new PatchMap<string, AutoEncoderPatchType<ResourcePermissions>|ResourcePermissions|null>()
                subPatch.set(props.resource.id, null)
                patch.resources!.set(props.resource.type, subPatch)
                addPatch(patch)
                return;
            }
        }

        const subPatch = new PatchMap<string, AutoEncoderPatchType<ResourcePermissions>|ResourcePermissions|null>()

        if (resourcePermissions.value) {
            subPatch.set(props.resource.id, ResourcePermissions.patch({
                level
            }))
        } else {
            subPatch.set(props.resource.id, ResourcePermissions.create({
                level
            }))
        }
        
        patch.resources!.set(props.resource.type, subPatch)
        addPatch(patch)
    }
})


const accessRightsMap: Map<AccessRight, Ref<boolean>> = new Map()

for (const accessRight of props.configurableAccessRights) {
    const hasAccessRight = computed({
        get: () => resourcePermissions?.value?.accessRights?.includes(accessRight) ?? false,
        set: (enable: boolean) => {
            if (hasAccessRight.value === enable) {
                return
            }

            const subPatch = new PatchMap<string, AutoEncoderPatchType<ResourcePermissions>|ResourcePermissions|null>()

            if (resourcePermissions.value) {
                const p = ResourcePermissions.patch({})
                if (enable) {
                    p.accessRights.addDelete(accessRight) // prevent creating duplicates
                    p.accessRights.addPut(accessRight)
                } else {
                    p.accessRights.addDelete(accessRight)
                    p.accessRights.addDelete(accessRight) // auto correct duplicates
                }
                subPatch.set(props.resource.id, p)
            } else {
                subPatch.set(props.resource.id, ResourcePermissions.create({
                    level: PermissionLevel.None,
                    accessRights: [accessRight]
                }))
            }
            
            const patch = createPatch()
            patch.resources!.set(props.resource.type, subPatch)
            addPatch(patch)
        }
    })
    accessRightsMap.set(accessRight, hasAccessRight)
}

const locked = computed(() => {
    return lockedMinimumLevel.value !== PermissionLevel.None
})
const selected = computed({
    get: () => lockedMinimumLevel.value !== PermissionLevel.None || (!!resourcePermissions.value && (resourcePermissions.value.level !== PermissionLevel.None || !!resourcePermissions.value?.accessRights.length)),
    set: (value: boolean) => {
        if (value === selected.value) {
            return
        }
        if (locked.value) {
            return
        }
        
        if (value) {
            permissionLevel.value = PermissionLevel.Read
        } else {
            // Delete it
            const patch = createPatch()
            const subPatch = new PatchMap<string, AutoEncoderPatchType<ResourcePermissions>|ResourcePermissions|null>()
            subPatch.set(props.resource.id, null)
            patch.resources!.set(props.resource.type, subPatch)
            addPatch(patch)
        }
    }
})

const levelText = computed(() => {
    switch(permissionLevel.value) {
        case PermissionLevel.None: {
            // Loop over all access rights
            const accessRights = resourcePermissions.value?.accessRights ?? []
            if (accessRights.length) {
                return accessRights.map(r => AccessRightHelper.getNameShort(r)).join(" + ")
            }
            return "Geen toegang";
        }
        case PermissionLevel.Read: {
            const rights = ['Lezen']
            const accessRights = resourcePermissions.value?.accessRights ?? []
            
            for (const right of accessRights) {
                const base = AccessRightHelper.autoGrantRightForLevel(right);
                if (!base || getPermissionLevelNumber(base) > getPermissionLevelNumber(PermissionLevel.Read)) {
                    // This is not automatically granted for read permissions
                    rights.push(AccessRightHelper.getNameShort(right))
                }
            }

            return rights.join(' + ')
        }
        case PermissionLevel.Write: {
            const rights = ['Bewerken']
            const accessRights = resourcePermissions.value?.accessRights ?? []
            
            for (const right of accessRights) {
                const base = AccessRightHelper.autoGrantRightForLevel(right);
                if (!base || getPermissionLevelNumber(base) > getPermissionLevelNumber(PermissionLevel.Write)) {
                    // This is not automatically granted for read permissions
                    rights.push(AccessRightHelper.getNameShort(right))
                }
            }

            return rights.join(' + ')
        }
        case PermissionLevel.Full: {
            const rights = ['Volledige toegang']
            const accessRights = resourcePermissions.value?.accessRights ?? []
            
            for (const right of accessRights) {
                const base = AccessRightHelper.autoGrantRightForLevel(right);
                if (!base || getPermissionLevelNumber(base) > getPermissionLevelNumber(PermissionLevel.Full)) {
                    // This is not automatically granted for read permissions
                    rights.push(AccessRightHelper.getNameShort(right))
                }
            }

            return rights.join(' + ')
        }
        default: {
            const _exhaustiveCheck: never = permissionLevel.value;
            return _exhaustiveCheck;
        }
    }
})

const choosePermissions = async (event: MouseEvent) => {
    const showAccessRights = props.configurableAccessRights
    const contextMenu = new ContextMenu([
        // Base levels
        [
            new ContextMenuItem({
                selected: permissionLevel.value === PermissionLevel.None,
                name: 'Geen basistoegang',
                disabled: getPermissionLevelNumber(PermissionLevel.None) < getPermissionLevelNumber(lockedMinimumLevel.value),
                action: () => {
                    permissionLevel.value = PermissionLevel.None
                }
            }),
            new ContextMenuItem({
                selected: permissionLevel.value === PermissionLevel.Read,
                name: 'Lezen',
                disabled: getPermissionLevelNumber(PermissionLevel.Read) < getPermissionLevelNumber(lockedMinimumLevel.value),
                action: () => {
                    permissionLevel.value = PermissionLevel.Read
                }
            }),
            new ContextMenuItem({
                selected: permissionLevel.value === PermissionLevel.Write,
                name: 'Bewerken',
                disabled: getPermissionLevelNumber(PermissionLevel.Write) < getPermissionLevelNumber(lockedMinimumLevel.value),
                action: () => {
                    permissionLevel.value = PermissionLevel.Write
                }
            }),
            new ContextMenuItem({
                selected: permissionLevel.value === PermissionLevel.Full,
                disabled: getPermissionLevelNumber(PermissionLevel.Full) < getPermissionLevelNumber(lockedMinimumLevel.value),
                name: 'Volledige toegang',
                action: () => {
                    permissionLevel.value = PermissionLevel.Full
                }
            })
        ],
        // Access rights
        ...(showAccessRights.length > 0 ? [
            showAccessRights.map((accessRight) => {
                const baseLevel = AccessRightHelper.autoGrantRightForLevel(accessRight)
                const included = !!baseLevel && getPermissionLevelNumber(permissionLevel.value) >= getPermissionLevelNumber(baseLevel)
                return new ContextMenuItem({
                    selected: included || accessRightsMap.get(accessRight)!.value,
                    name: AccessRightHelper.getName(accessRight),
                    disabled: included,
                    description: included ? ('Inbegrepen bij ' + getPermissionLevelName(baseLevel)) : ('Niet inbegrepen bij ' + getPermissionLevelName(permissionLevel.value)),
                    action: () => {
                        accessRightsMap.get(accessRight)!.value = !accessRightsMap.get(accessRight)!.value
                    }
                })
            })
        ] : [])
    ]);

    await contextMenu.show({
        button: event.currentTarget as HTMLElement,
        xPlacement: "left",
        yPlacement: "bottom",
    })
}

</script>

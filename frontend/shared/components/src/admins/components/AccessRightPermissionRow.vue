<template>
    <STListItem element-name="label" :selectable="true">
        <template #left>
            <Checkbox v-model="selected" :disabled="locked" />
        </template>

        <h2 class="style-title-list">
            {{ AccessRightHelper.getName(props.accessRight) }}
        </h2>
        <p class="style-description-small" v-if="AccessRightHelper.getLongDescription(props.accessRight)">
            {{ AccessRightHelper.getLongDescription(props.accessRight) }}
        </p>
    </STListItem>
</template>

<script setup lang="ts">
import { useEmitPatch } from '@stamhoofd/components';
import { AccessRight, AccessRightHelper, PermissionRoleDetailed, Permissions, getPermissionLevelNumber } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    accessRight: AccessRight,
    role: PermissionRoleDetailed;
    inheritedRoles?: (PermissionRoleDetailed|Permissions)[]
}>(), {
    inheritedRoles: () => [],
})


const emit = defineEmits(['patch:role'])
const {patched: role, addPatch, createPatch} = useEmitPatch<PermissionRoleDetailed>(props, emit, 'role');

const locked = computed(() => {
    const baseLevel = AccessRightHelper.autoGrantRightForLevel(props.accessRight)
    const autoInherit = AccessRightHelper.autoInheritFrom(props.accessRight)

    // Note, we only use auto inherit, so we don't check on the actual added access rights (because then not locked)
    for (const r of autoInherit) {
        if (role.value.hasAccessRight(r)) {
            return true
        }
    }

    if (baseLevel && getPermissionLevelNumber(role.value.level) >= getPermissionLevelNumber(baseLevel)) {
        return true
    }

    for (const inheritedRole of props.inheritedRoles!) {
        if (baseLevel && getPermissionLevelNumber(inheritedRole.level) >= getPermissionLevelNumber(baseLevel)) {
            return true
        }

        if (inheritedRole instanceof PermissionRoleDetailed) {
            if (inheritedRole.hasAccessRight(props.accessRight)) {
                return true
            }
        }
    }

    return false;

})

const selected = computed({
    get: () => locked.value || role.value.hasAccessRight(props.accessRight),
    set: (value: boolean) => {
        if (value === selected.value) {
            return
        }
        if (locked.value) {
            return
        }
        
        if (value) {
            const patch = createPatch()
            patch.accessRights.addDelete(props.accessRight)
            patch.accessRights.addPut(props.accessRight)
            addPatch(patch)
        } else {
            // Delete it
            const patch = createPatch()
            patch.accessRights.addDelete(props.accessRight)
            patch.accessRights.addDelete(props.accessRight)
            addPatch(patch)
        }
    }
})


</script>

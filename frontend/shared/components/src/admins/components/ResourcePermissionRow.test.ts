import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import type { Permissions } from '@stamhoofd/structures';
import { AccessRight, AccessRightHelper, getPermissionLevelName, PermissionLevel, PermissionRoleDetailed, PermissionsResourceKey, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import Checkbox from '#inputs/Checkbox.vue';
import STListItem from '#layout/STListItem.vue';
import ResourcePermissionRow from './ResourcePermissionRow.vue';

type Grant = { level?: PermissionLevel; accessRights?: AccessRight[] };

function createRole(resources: Partial<Record<PermissionsResourceType, Record<string, Grant>>> = {}, level = PermissionLevel.None) {
    return PermissionRoleDetailed.create({
        name: 'Role',
        level,
        resources: new Map(Object.entries(resources).map(([type, grants]) => [
            type as PermissionsResourceType,
            new Map(Object.entries(grants).map(([id, grant]) => [id, ResourcePermissions.create({ resourceName: id, level: grant.level ?? PermissionLevel.None, accessRights: grant.accessRights ?? [] })])),
        ])),
    });
}

function renderRow(props: { resource: { id: string; type: PermissionsResourceType }; role: PermissionRoleDetailed | Permissions; inheritedRoles?: PermissionRoleDetailed[]; configurableAccessRights?: AccessRight[]; inCurrentPeriod?: boolean }) {
    const patches: AutoEncoderPatchType<PermissionRoleDetailed>[] = [];
    render(ResourcePermissionRow, {
        props: {
            'resource': { id: props.resource.id, name: 'Resource ' + props.resource.id, type: props.resource.type },
            'role': props.role,
            'inheritedRoles': props.inheritedRoles ?? [],
            'configurableAccessRights': props.configurableAccessRights ?? [],
            'inCurrentPeriod': props.inCurrentPeriod ?? true,
            'type': 'resource',
            'onPatch:role': (patch: AutoEncoderPatchType<PermissionRoleDetailed>) => patches.push(patch),
        },
        global: {
            components: { STListItem, Checkbox },
            provide: {
                $context: { auth: { unloadedPermissions: null } },
            },
            mocks: {
                $t: (globalThis as any).$t,
            },
        },
    });

    return {
        patches,
        checkbox: document.querySelector('input[type="checkbox"]') as HTMLInputElement,
        levelText: () => document.querySelector('.right button span')?.textContent ?? null,
    };
}

const groupId = 'group-1';
const shopId = 'shop-1';

test.each([
    ['groups', PermissionsResourceType.Groups, groupId, PermissionsResourceKey.CurrentPeriod],
    ['groups', PermissionsResourceType.Groups, groupId, PermissionsResourceKey.All],
    ['the current period of groups', PermissionsResourceType.Groups, PermissionsResourceKey.CurrentPeriod, PermissionsResourceKey.All],
    ['webshops', PermissionsResourceType.Webshops, shopId, PermissionsResourceKey.All],
])('a grant on %s locks the row of a covered resource', (_, type, id, wildcard) => {
    const role = createRole({ [type]: { [wildcard]: { level: PermissionLevel.Read } } });
    const row = renderRow({ resource: { id, type }, role });

    expect(row.checkbox.checked).toBe(true);
    expect(row.checkbox.disabled).toBe(true);
    expect(row.levelText()).toBe(getPermissionLevelName(PermissionLevel.Read, type));
});

test.each([
    ['all groups', PermissionsResourceType.Groups, PermissionsResourceKey.All, PermissionsResourceKey.CurrentPeriod],
    ['a webshop', PermissionsResourceType.Webshops, shopId, PermissionsResourceKey.CurrentPeriod],
    ['a group', PermissionsResourceType.Groups, groupId, 'group-2'],
])('the row of %s stays editable when only narrower resources are granted', (_, type, id, other) => {
    const role = createRole({ [type]: { [other]: { level: PermissionLevel.Full } } });
    const row = renderRow({ resource: { id, type }, role });

    expect(row.checkbox.checked).toBe(false);
    expect(row.checkbox.disabled).toBe(false);
});

test('a grant on the current period does not lock a resource of another period', () => {
    const role = createRole({ [PermissionsResourceType.Groups]: { [PermissionsResourceKey.CurrentPeriod]: { level: PermissionLevel.Full, accessRights: [AccessRight.EventWrite] } } });
    const inherited = createRole({ [PermissionsResourceType.Groups]: { [PermissionsResourceKey.CurrentPeriod]: { level: PermissionLevel.Full } } });
    const row = renderRow({ resource: { id: groupId, type: PermissionsResourceType.Groups }, role, inheritedRoles: [inherited], configurableAccessRights: [AccessRight.EventWrite], inCurrentPeriod: false });

    expect(row.checkbox.checked).toBe(false);
    expect(row.checkbox.disabled).toBe(false);
});

test('the highest level of the role itself and the inherited roles wins', () => {
    const role = createRole({ [PermissionsResourceType.Groups]: { [groupId]: { level: PermissionLevel.Read } } });
    const inherited = createRole({ [PermissionsResourceType.Groups]: { [PermissionsResourceKey.CurrentPeriod]: { level: PermissionLevel.Write } } });
    const row = renderRow({ resource: { id: groupId, type: PermissionsResourceType.Groups }, role, inheritedRoles: [inherited] });

    expect(row.checkbox.checked).toBe(true);
    expect(row.checkbox.disabled).toBe(true);
    expect(row.levelText()).toBe(getPermissionLevelName(PermissionLevel.Write, PermissionsResourceType.Groups));
});

test('a specific grant in an inherited role locks the row', () => {
    const inherited = createRole({ [PermissionsResourceType.Webshops]: { [shopId]: { level: PermissionLevel.Full } } });
    const row = renderRow({ resource: { id: shopId, type: PermissionsResourceType.Webshops }, role: createRole(), inheritedRoles: [inherited] });

    expect(row.checkbox.disabled).toBe(true);
    expect(row.levelText()).toBe(getPermissionLevelName(PermissionLevel.Full, PermissionsResourceType.Webshops));
});

test('access rights granted on all resources lock the row and are listed', () => {
    const role = createRole({ [PermissionsResourceType.OrganizationTags]: { [PermissionsResourceKey.All]: { accessRights: [AccessRight.EventWrite] } } });
    const row = renderRow({ resource: { id: 'tag-1', type: PermissionsResourceType.OrganizationTags }, role, configurableAccessRights: [AccessRight.EventWrite] });

    expect(row.checkbox.checked).toBe(true);
    expect(row.checkbox.disabled).toBe(true);
    expect(row.levelText()).toBe(AccessRightHelper.getNameShort(AccessRight.EventWrite));
});

test.each([
    [PermissionsResourceKey.CurrentPeriod],
    [groupId],
])('selecting an editable row grants the resource under its own key (%s)', async (id) => {
    const row = renderRow({ resource: { id, type: PermissionsResourceType.Groups }, role: createRole() });

    row.checkbox.click();
    await Promise.resolve();

    expect(row.patches).toHaveLength(1);
    const granted = row.patches[0].resources.get(PermissionsResourceType.Groups)?.get(id);
    expect(granted).toBeInstanceOf(ResourcePermissions);
    expect((granted as ResourcePermissions).level).toBe(PermissionLevel.Full);
});

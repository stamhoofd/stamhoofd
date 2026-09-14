import { ObjectData, PatchMap } from '@simonbackx/simple-encoding';
import { PermissionLevel } from './PermissionLevel.js';
import { PermissionRoleDetailed } from './PermissionRole.js';
import { Permissions } from './Permissions.js';
import { PermissionsResourceKey, PermissionsResourceType } from './PermissionsResourceType.js';
import { ResourcePermissions } from './ResourcePermissions.js';
import { Version } from './Version.js';

describe.each([
    { name: 'Permissions', Structure: Permissions },
    { name: 'PermissionRoleDetailed', Structure: PermissionRoleDetailed },
])('Unit.$name resource key patches', ({ Structure }) => {
    const grant = () => ResourcePermissions.create({ level: PermissionLevel.Full, resourceName: 'Existing name' });

    test('leaves permissions unchanged when the patch omits resources', () => {
        const original = Structure.create({ resources: new Map([[PermissionsResourceType.Senders, new Map([[PermissionsResourceKey.All, grant()]])]]) });
        const patch = Structure.patchType().decode(new ObjectData({ level: PermissionLevel.Read }, { version: 417 }));

        expect(original.patch(patch).resources).toEqual(original.resources);
    });

    describe.each([
        [PermissionsResourceType.Groups, PermissionsResourceKey.CurrentPeriod],
        [PermissionsResourceType.Senders, PermissionsResourceKey.All],
    ] as const)('%s', (type, wildcard) => {
        function initial() {
            return Structure.create({
                resources: new Map([
                    [type, new Map([[wildcard, grant()], ['specific', grant()]])],
                    [PermissionsResourceType.Webshops, new Map([['shop', grant()]])],
                ]),
            });
        }

        test('upgrades legacy wildcard grants without replacing other resources', () => {
            const legacyPatch = Structure.patch({});
            legacyPatch.resources.set(type, new PatchMap([['', grant()]]));
            const patch = Structure.patchType().decode(new ObjectData(legacyPatch.encode({ version: 417 }), { version: 417 }));
            const original = initial();
            original.resources.get(type)!.delete(wildcard);
            const result = original.patch(patch);

            expect(result.resources.get(type)!.get(wildcard)?.level).toBe(PermissionLevel.Full);
            expect(result.resources.get(type)!.has('')).toBe(false);
            expect(result.resources.get(type)!.has('specific')).toBe(true);
            expect(result.resources.has(PermissionsResourceType.Webshops)).toBe(true);
            expect(original.resources.get(type)!.has(wildcard)).toBe(false);
        });

        test('upgrades legacy wildcard revocations without deleting unrelated grants', () => {
            const legacyPatch = Structure.patch({});
            legacyPatch.resources.set(type, new PatchMap([['', null]]));
            const patch = Structure.patchType().decode(new ObjectData(legacyPatch.encode({ version: 417 }), { version: 417 }));
            const result = initial().patch(patch);

            expect(result.resources.get(type)!.has(wildcard)).toBe(false);
            expect(result.resources.get(type)!.has('specific')).toBe(true);
            expect(result.resources.has(PermissionsResourceType.Webshops)).toBe(true);
        });

        test('preserves nested permission patches and resource-type deletions', () => {
            const legacyPatch = Structure.patch({});
            legacyPatch.resources.set(type, new PatchMap([['', ResourcePermissions.patch({ level: PermissionLevel.Read })]]));
            legacyPatch.resources.set(PermissionsResourceType.Webshops, null);
            const patch = Structure.patchType().decode(new ObjectData(legacyPatch.encode({ version: 417 }), { version: 417 }));
            const result = initial().patch(patch);

            expect(result.resources.get(type)!.get(wildcard)?.level).toBe(PermissionLevel.Read);
            expect(result.resources.get(type)!.get(wildcard)?.resourceName).toBe('Existing name');
            expect(result.resources.get(type)!.has('specific')).toBe(true);
            expect(result.resources.has(PermissionsResourceType.Webshops)).toBe(false);
        });

        test('keeps replacement maps as replacements inside patches', () => {
            const legacyPatch = Structure.patch({});
            legacyPatch.resources.set(type, new Map([['', grant()]]));
            const patch = Structure.patchType().decode(new ObjectData(legacyPatch.encode({ version: 417 }), { version: 417 }));
            const result = initial().patch(patch);

            expect(result.resources.get(type)!.get(wildcard)?.level).toBe(PermissionLevel.Full);
            expect(result.resources.get(type)!.has('specific')).toBe(false);
            expect(result.resources.has(PermissionsResourceType.Webshops)).toBe(true);
        });

        test.each([false, true])('downgrades wildcard patches with deletion=%s', (deletion) => {
            const patch = Structure.patch({});
            patch.resources.set(type, new PatchMap([[wildcard, deletion ? null : grant()]]));
            patch.resources.set(PermissionsResourceType.Webshops, null);
            const encoded = patch.encode({ version: 417 });

            expect(encoded).toMatchObject({
                resources: {
                    _isPatch: true,
                    changes: {
                        [type]: { _isPatch: true, changes: { '': deletion ? null : grant().encode({ version: 417 }) } },
                        [PermissionsResourceType.Webshops]: null,
                    },
                },
            });
            expect(Structure.patchType().decode(new ObjectData(encoded, { version: 417 })).encode({ version: Version })).toEqual(patch.encode({ version: Version }));
        });
    });
});

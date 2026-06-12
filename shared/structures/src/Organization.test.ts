import { TestUtils } from '@stamhoofd/test-utils';

import { STPackageStatus, STPackageType } from './billing/STPackage.js';
import { Organization } from './Organization.js';
import { OrganizationMetaData, OrganizationPackages } from './OrganizationMetaData.js';

describe('Unit.Organization', () => {
    describe('showInternalAdmins', () => {
        function buildOrganization(useMembers: boolean) {
            const packages = OrganizationPackages.create({});
            if (useMembers) {
                packages.packages.set(STPackageType.Members, STPackageStatus.create({
                    startDate: new Date(0),
                }));
            }
            return Organization.create({
                name: 'Test',
                meta: OrganizationMetaData.create({ packages }),
            });
        }

        test('It is hidden in organization mode when the members package is not used', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            expect(buildOrganization(false).showInternalAdmins).toBe(false);
        });

        test('It is shown in organization mode when the members package is used', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            expect(buildOrganization(true).showInternalAdmins).toBe(true);
        });

        test('It is always shown in platform mode, even without the members package', () => {
            TestUtils.setEnvironment('userMode', 'platform');
            expect(buildOrganization(false).showInternalAdmins).toBe(true);
        });
    });
});

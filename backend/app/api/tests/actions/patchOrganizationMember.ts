import { AutoEncoderPatchType, PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import { Organization } from '@stamhoofd/models';
import { MemberWithRegistrationsBlob } from '@stamhoofd/structures';
import { PatchOrganizationMembersEndpoint } from '../../src/endpoints/global/members/PatchOrganizationMembersEndpoint.js';
import { testServer } from '../helpers/TestServer.js';
import { initAdmin } from '../init/initAdmin.js';

export async function patchOrganizationMember({ patch, organization }: { patch: AutoEncoderPatchType<MemberWithRegistrationsBlob>; organization: Organization }) {
    expect(patch.id).toBeString();
    const { adminToken } = await initAdmin({ organization: organization });

    const arr = new PatchableArray();
    arr.addPatch(patch);

    const request = Request.patch({
        path: '/organization/members',
        host: organization.getApiHost(),
        body: arr,
        headers: {
            authorization: 'Bearer ' + adminToken.accessToken,
        },
    });

    const response = await testServer.test(new PatchOrganizationMembersEndpoint(), request);
    expect(response.status).toBe(200);
}

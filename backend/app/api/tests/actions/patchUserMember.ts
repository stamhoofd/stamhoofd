import { AutoEncoderPatchType, PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import { Organization, Token, User } from '@stamhoofd/models';
import { MemberWithRegistrationsBlob } from '@stamhoofd/structures';
import { PatchUserMembersEndpoint } from '../../src/endpoints/global/registration/PatchUserMembersEndpoint.js';
import { testServer } from '../helpers/TestServer.js';

export async function patchUserMember({ patch, organization, user }: { patch: AutoEncoderPatchType<MemberWithRegistrationsBlob>; organization: Organization; user: User }) {
    expect(patch.id).toBeString();

    const token = await Token.createToken(user);

    const arr = new PatchableArray();
    arr.addPatch(patch);

    const request = Request.patch({
        path: '/members',
        host: organization.getApiHost(),
        body: arr,
        headers: {
            authorization: 'Bearer ' + token.accessToken,
        },
    });

    const response = await testServer.test(new PatchUserMembersEndpoint(), request);
    expect(response.status).toBe(200);
}

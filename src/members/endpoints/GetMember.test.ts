import { GetMember } from "./GetMember";
import { Request } from '@/routing/classes/Request';
import { OrganizationFactory } from '@/organizations/factories/OrganizationFactory';
import { MemberFactory } from '../factories/MemberFactory';

// Test endpoint
const getMemberEndpoint = new GetMember()

test('Get data of member 67', async () => {
    const organization = await new OrganizationFactory({}).create()
    const member = await new MemberFactory({ organization: organization }).create()
    const r = Request.buildJson("GET", "/members/" + member.id, organization.getApiHost());

    const response = await getMemberEndpoint.getResponse(r, { id: member.id as number });
    expect(response.body).toEqual({ organizationId: organization.id, encrypted: member.encrypted });
});
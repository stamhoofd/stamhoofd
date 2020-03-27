import { GetMember } from "./GetMember";
import { Request } from '../../routing/classes/Request';

// Test endpoint
const getMemberEndpoint = new GetMember()


test('Get data of member 67', async () => {
    const r = Request.buildJson("GET", "/members/67");

    const response = await getMemberEndpoint.getResponse(r, { id: 67 });
    expect(response.body).toBe(3);
});
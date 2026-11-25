import { Request } from '@node/endpoints';
import {
    JudicialRecord,
    MemberFactory,
    OrganizationFactory,
    RegistrationFactory,
    UserFactory,
} from '@stamhoofd/models';
import { JudicialRecordReviewDecision, JudicialRecordReviewDetails } from '@stamhoofd/structures';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetUserMembersEndpoint } from './GetUserMembersEndpoint.js';

const endpoint = new GetUserMembersEndpoint();

const comment = 'Enkel onder begeleiding van een tweede leiding.';

async function setup() {
    const organization = await new OrganizationFactory({}).create();
    const user = await new UserFactory({ organization }).create();
    const member = await new MemberFactory({ organization, user }).create();
    await new RegistrationFactory({ member, organization }).create();

    const record = new JudicialRecord();
    record.memberId = member.id;
    record.reviewDecision = JudicialRecordReviewDecision.ConditionallyAccepted;
    record.reviewedAt = new Date();
    record.reviewDetails = JudicialRecordReviewDetails.create({
        name: 'Mieke Janssens',
        email: 'mieke@example.com',
        comment,
    });
    await record.save();

    return { organization, user, member };
}

async function fetchMembers(organization: { getApiHost: () => string }, user: { id: string }) {
    const token = await SessionService.createSession(user as any);
    const request = Request.buildJson('GET', '/user/members', organization.getApiHost());
    request.headers.authorization = 'Bearer ' + token.accessToken;

    const response = await testServer.test(endpoint, request);
    expect(response.status).toBe(200);
    return response.body.members;
}

describe('Endpoint.GetUserMembersEndpoint', () => {
    test('the member reads the comment a reviewer wrote about their own record', async () => {
        const { organization, user, member } = await setup();

        const members = await fetchMembers(organization, user);
        const blob = members.find((m) => m.id === member.id);

        expect(blob?.judicialRecord?.reviewDecision).toBe(
            JudicialRecordReviewDecision.ConditionallyAccepted,
        );
        expect(blob?.judicialRecord?.comment).toBe(comment);
    });
});

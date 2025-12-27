import { MemberFactory } from '@stamhoofd/models';
import {
    MemberDetails,
    UitpasNumberDetails,
    UitpasSocialTariff,
    UitpasSocialTariffStatus,
} from '@stamhoofd/structures';
import { initUitpasApi } from '../../tests/init/initUitpasApi.js';
import { updateMemberDetailsUitpasNumber } from './updateMemberDetailsUitpasNumber.js';

describe('updateMemberDetailsUitpasNumber', () => {
    it('Should update updatedAt', async () => {
        initUitpasApi();

        const updatedAt = new Date(2010, 1, 1);
        const member = await new MemberFactory({
            firstName: 'John',
            lastName: 'Doe',
            details: MemberDetails.create({
                uitpasNumberDetails: UitpasNumberDetails.create({
                    // expired
                    uitpasNumber: '0900000031618',
                    socialTariff: UitpasSocialTariff.create({
                        // but active in the past
                        status: UitpasSocialTariffStatus.Active,
                        // end date in the past
                        endDate: new Date(2000, 1, 1),
                        updatedAt: new Date(updatedAt.getTime()),
                    }),
                }),
            }),
        }).create();

        // act
        await updateMemberDetailsUitpasNumber(member.details);

        // updated at should be updated
        expect(
            member.details.uitpasNumberDetails?.socialTariff?.updatedAt,
        ).toBeDate();
        expect(
            member.details.uitpasNumberDetails?.socialTariff?.updatedAt?.getTime(),
        ).not.toBe(updatedAt.getTime());
    });

    it('Should not update the social tariff if updated recently', async () => {
        initUitpasApi();

        const member = await new MemberFactory({
            firstName: 'John',
            lastName: 'Doe',
            details: MemberDetails.create({
                uitpasNumberDetails: UitpasNumberDetails.create({
                    // active
                    uitpasNumber: '0900011354819',
                }),
            }),
        }).create();

        // act
        let isUpdated = await updateMemberDetailsUitpasNumber(member.details);
        expect(isUpdated).toBe(true);

        // update again => should not update again
        isUpdated = await updateMemberDetailsUitpasNumber(member.details);
        expect(isUpdated).toBe(false);
    });
});

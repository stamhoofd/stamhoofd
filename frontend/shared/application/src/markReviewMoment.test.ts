import { Organization } from '@stamhoofd/structures';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { markReviewMoment } from './markReviewMoment';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('review eligibility', () => {
    test('sessions without an organization remain eligible', () => {
        const mark = vi.spyOn(AppManager.shared, 'markReviewMoment');
        markReviewMoment(null);
        expect(mark).toHaveBeenCalledExactlyOnceWith({ eligible: true });
    });

    test.each([
        { members: false, membersTrial: false, webshops: false, webshopsTrial: false, eligible: false },
        { members: true, membersTrial: true, webshops: false, webshopsTrial: false, eligible: false },
        { members: false, membersTrial: false, webshops: true, webshopsTrial: true, eligible: false },
        { members: true, membersTrial: true, webshops: true, webshopsTrial: true, eligible: false },
        { members: true, membersTrial: false, webshops: false, webshopsTrial: false, eligible: true },
        { members: false, membersTrial: false, webshops: true, webshopsTrial: false, eligible: true },
        { members: true, membersTrial: false, webshops: true, webshopsTrial: true, eligible: true },
        { members: true, membersTrial: true, webshops: true, webshopsTrial: false, eligible: true },
    ])('preserves package eligibility: %j', ({ members, membersTrial, webshops, webshopsTrial, eligible }) => {
        const organization = Organization.create({});
        const packages = organization.meta.packages;
        vi.spyOn(packages, 'useMembers', 'get').mockReturnValue(members);
        vi.spyOn(packages, 'isMembersTrial', 'get').mockReturnValue(membersTrial);
        vi.spyOn(packages, 'useWebshops', 'get').mockReturnValue(webshops);
        vi.spyOn(packages, 'isWebshopsTrial', 'get').mockReturnValue(webshopsTrial);
        const mark = vi.spyOn(AppManager.shared, 'markReviewMoment');

        markReviewMoment(organization);

        expect(mark).toHaveBeenCalledExactlyOnceWith({ eligible });
    });
});

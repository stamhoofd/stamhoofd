import { Organization } from '@stamhoofd/structures';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppManager } from './AppManager';
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
        { name: 'no active package', members: false, membersTrial: false, webshops: false, webshopsTrial: false, eligible: false },
        { name: 'members trial', members: true, membersTrial: true, webshops: false, webshopsTrial: false, eligible: false },
        { name: 'webshops trial', members: false, membersTrial: false, webshops: true, webshopsTrial: true, eligible: false },
        { name: 'both trials', members: true, membersTrial: true, webshops: true, webshopsTrial: true, eligible: false },
        { name: 'paid members', members: true, membersTrial: false, webshops: false, webshopsTrial: false, eligible: true },
        { name: 'paid webshops', members: false, membersTrial: false, webshops: true, webshopsTrial: false, eligible: true },
        { name: 'paid members and webshops trial', members: true, membersTrial: false, webshops: true, webshopsTrial: true, eligible: true },
        { name: 'members trial and paid webshops', members: true, membersTrial: true, webshops: true, webshopsTrial: false, eligible: true },
    ])('$name', ({ members, membersTrial, webshops, webshopsTrial, eligible }) => {
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

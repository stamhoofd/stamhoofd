import type { Page } from '@playwright/test';
import type { Group, Organization } from '@stamhoofd/models';
import { DashboardPage } from './DashboardPage.js';
import { GroupOverviewPage } from './GroupOverviewPage.js';
import { MemberPortalPage } from './MemberPortalPage.js';

/**
 * Helper to easily select a page.
 */
export class Pages {
    get dashboard() {
        return new DashboardPage(this.page);
    }

    get memberPortal() {
        return new MemberPortalPage(this.page);
    }

    groupOverview({
        group,
        organization,
    }: {
        group: Group;
        organization: Organization;
    }) {
        return new GroupOverviewPage(this.page, group, organization);
    }

    categoryOverview({
        group,
        organization,
    }: {
        group: Group;
        organization: Organization;
    }) {
        return new GroupOverviewPage(this.page, group, organization);
    }

    constructor(public readonly page: Page) {}
}

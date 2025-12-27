import type { Page } from "@playwright/test";
import { Group, Organization } from "@stamhoofd/models";
import { Formatter } from "@stamhoofd/utility";
import { WorkerData } from "../worker/WorkerData";

export class CategoryOverviewPage {
    constructor(
        public readonly page: Page,
        private readonly group: Group,
        private readonly organization: Organization,
    ) {}

    private get url() {
        const slug = Formatter.slug(this.group.settings.name);

        return `${WorkerData.urls.dashboard}/dashboard/${this.organization.uri}/leden/categorie/${slug}`;
    }

    async goto() {
        await this.page.goto(this.url);
    }

    async gotoRegistrations() {
        await this.page.goto(`${this.url}/inschrijvingen`);
    }
}

import type { Page } from '@playwright/test';
import { WorkerData } from '../worker/WorkerData';

export class DashboardPage {
    constructor(public readonly page: Page) {}

    async goto() {
        await this.page.goto(WorkerData.urls.dashboard);
    }
}

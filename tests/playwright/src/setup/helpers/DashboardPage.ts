import type { Page } from '@playwright/test';
import { WorkerData } from './WorkerData';

export class DashboardPage {

  constructor(public readonly page: Page) {
  }

  async goto() {
    await this.page.goto(WorkerData.urls.dashboard);
  }
}

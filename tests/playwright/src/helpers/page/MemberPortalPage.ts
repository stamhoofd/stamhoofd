import type { Page } from "@playwright/test";
import { WorkerData } from "../worker/WorkerData";

export class MemberPortalPage {
    constructor(public readonly page: Page) {}

    async goto() {
        if (STAMHOOFD.userMode === "platform") {
            await this.page.goto(`${WorkerData.urls.dashboard}/leden`);
        } else {
            throw new Error(
                "Registration page is not implemented for usermode: " +
                    STAMHOOFD.userMode,
            );
        }
    }
}

import { SetupStepUpdater } from "@stamhoofd/models";

export async function updateSetupSteps() {
    if (STAMHOOFD.userMode !== "platform") {
        return;
    }

    await SetupStepUpdater.updateSetupStepsForAllOrganizationsInCurrentPeriod();
}

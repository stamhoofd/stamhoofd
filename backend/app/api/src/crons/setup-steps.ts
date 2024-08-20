import { SetupStepUpdater } from "../helpers/SetupStepsUpdater";

export async function updateSetupSteps() {
    if (STAMHOOFD.userMode !== "platform") {
        return;
    }

    await SetupStepUpdater.updateSetupStepsForAllOrganizationsInCurrentPeriod();
}

import type { AutoEncoderPatchType, PartialWithoutMethods} from '@simonbackx/simple-encoding';
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import type { Organization} from '@stamhoofd/structures';
import { Group, GroupPrivateSettings, GroupSettings, OrganizationRegistrationPeriod, Version } from '@stamhoofd/structures';

@Component
export default class EditGroupMixin extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    group: Group;

    /**
     *  == patched organization <-> $organization (= unpatched)
     */
    @Prop({ required: true })
    organization: Organization;

    /**
     *  == patched organization <-> $organization (= unpatched)
     */
    @Prop({ required: true })
    period: OrganizationRegistrationPeriod;

    @Prop({ default: false })
    isNew: boolean;

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>);

    patchPeriod: AutoEncoderPatchType<OrganizationRegistrationPeriod> = OrganizationRegistrationPeriod.patch({});

    saving = false;

    errorBox: ErrorBox | null = null;
    validator = new Validator();

    get patchedPeriod() {
        return this.period.patch(this.patchPeriod);
    }

    get patchedGroup() {
        const c = this.patchedPeriod.groups.find(c => c.id == this.group.id);
        if (c) {
            return c;
        }
        return this.group;
    }

    addPeriodPatch(patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) {
        this.patchPeriod = this.patchPeriod.patch(patch);
    }

    addPatch(patch: AutoEncoderPatchType<Group>) {
        patch.id = this.group.id;
        const p = OrganizationRegistrationPeriod.patch({});
        p.groups.addPatch(patch);
        this.addPeriodPatch(p);
    }

    addSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupSettings>>) {
        this.addPatch(Group.patch({
            id: this.group.id,
            settings: GroupSettings.patch(patch),
        }));
    }

    addPrivateSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupPrivateSettings>>) {
        this.addPatch(Group.patch({
            id: this.group.id,
            privateSettings: GroupPrivateSettings.patch(patch),
        }));
    }

    get hasChanges() {
        return patchContainsChanges(this.patchPeriod, this.period, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
    }

    validate(): Promise<void> | void {
        // override if needed
    }

    shouldDismiss(): Promise<boolean> | boolean {
        return true;
    }

    async save() {
        if (this.saving) {
            return;
        }

        this.saving = true;

        try {
            if (!await this.validator.validate()) {
                this.saving = false;
                return;
            }

            await this.validate();

            await this.saveHandler(this.patchPeriod);

            const dis = await this.shouldDismiss();
            if (dis) {
                await this.dismiss({ force: true });
            }
        }
        catch (e) {
            console.error(e);
            this.errorBox = new ErrorBox(e);
        }

        this.saving = false;
    }
}

import { Factory } from "@simonbackx/simple-database";

import { RegisterCode } from "../models";

type OrganizationOptions = {
    organizationId: string
} | {organization: {id: string}}

type Options = OrganizationOptions & {
    value?: number;
    description?: string;
}

export class RegisterCodeFactory extends Factory<Options, RegisterCode> {
    async create(): Promise<RegisterCode> {
        const code = new RegisterCode();
        code.organizationId = "organizationId" in this.options ? this.options.organizationId : this.options.organization.id;
        code.value = this.options.value ?? (25 * 100);
        code.description = this.options.description ?? "Test code";

        await code.generateCode();
        await code.save();
        return code;
    }
}

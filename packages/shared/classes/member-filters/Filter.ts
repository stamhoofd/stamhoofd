import { Member } from "@stamhoofd/shared/models/Member";

export interface Filter {
    getName(): string;
    doesMatch(member: Member): boolean;
}

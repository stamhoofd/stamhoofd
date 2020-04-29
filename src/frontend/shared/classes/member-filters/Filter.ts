import { Member } from "@stamhoofd-frontend/models";

export interface Filter {
    getName(): string;
    doesMatch(member: Member): boolean;
}

import { Member } from "@/shared/models/Member";

export interface Filter {
    getName(): string;
    doesMatch(member: Member): boolean;
}

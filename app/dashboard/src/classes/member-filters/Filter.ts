import { Member } from "@stamhoofd-frontend/models";
import { DecryptedMember } from '@stamhoofd/structures';

export interface Filter {
    getName(): string;
    doesMatch(member: DecryptedMember): boolean;
}

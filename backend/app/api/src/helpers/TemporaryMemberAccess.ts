import { getPermissionLevelNumber, PermissionLevel } from '@stamhoofd/structures';

const userMemberTemporaryAccessCache = new Map<string, { memberId: string; level: PermissionLevel; validUntil: Date }[]>();

export function hasTemporaryMemberAccess(userId: string, memberId, level: PermissionLevel) {
    const list = userMemberTemporaryAccessCache.get(userId);
    if (!list) {
        return false;
    }
    const d = new Date();
    return !!list.find(m =>
        m.memberId === memberId
        && getPermissionLevelNumber(m.level) >= getPermissionLevelNumber(level)
        && m.validUntil > d,
    );
}

export function addTemporaryMemberAccess(userId: string, memberId, level: PermissionLevel, timeout: number = 1000 * 60 * 60 * 24) {
    deleteExpiredTemporaryMemberAccess();
    let list = userMemberTemporaryAccessCache.get(userId);
    if (!list) {
        list = [];
        userMemberTemporaryAccessCache.set(userId, list);
    }
    list.push({ memberId, level, validUntil: new Date(Date.now() + timeout) });
}

export function deleteExpiredTemporaryMemberAccess() {
    const d = new Date();
    for (const [userId, list] of userMemberTemporaryAccessCache) {
        const filtered = list.filter(m => m.validUntil > d);

        if (filtered.length === 0) {
            userMemberTemporaryAccessCache.delete(userId);
        }
        else {
            userMemberTemporaryAccessCache.set(userId, filtered);
        }
    }
}

export const SGV_LOGIN_AUTHORIZE_PATH
    = '/realms/scouts/protocol/openid-connect/auth';
export const SGV_LOGIN_TOKEN_PATH
    = '/realms/scouts/protocol/openid-connect/token';
export const SGV_GROUP_PATH = '/groep';
export const SGV_FUNCTION_PATH = '/functie';
export const SGV_PROFILE_PATH = '/lid/profiel';
export const SGV_MEMBER_LIST_FILTER_PATH = '/ledenlijst/filter/huidige';
export const SGV_MEMBER_LIST_PATH = '/ledenlijst';
export const SGV_SEARCH_SIMILAR_PATH = '/zoeken/gelijkaardig';
export const SGV_MEMBER_PATH = '/lid';

/** Builds the SGV member detail endpoint while preserving arbitrary external ids safely in the URL. */
export function sgvMemberPath(id: string): string {
    return `${SGV_MEMBER_PATH}/${encodeURIComponent(id)}`;
}

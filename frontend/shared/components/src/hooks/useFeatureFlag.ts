import { useOrganization } from "./useOrganization";

export function useFeatureFlag(): (flag: string) => boolean {
    const organization = useOrganization();

    return (flag: string) => {
        return organization.value?.privateMeta?.featureFlags.includes(flag) ?? false
    }
}

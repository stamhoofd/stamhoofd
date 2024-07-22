import { UserWithMembers } from "@stamhoofd/structures";
import { Ref, computed } from "vue";
import { useContext } from "./useContext";

export function useUser(): Ref<UserWithMembers | null> {
    const context = useContext()
    return computed(() => context.value.user);
}

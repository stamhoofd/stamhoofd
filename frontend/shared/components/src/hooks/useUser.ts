import { Ref, computed } from "vue";
import { User } from "@stamhoofd/structures";
import { useContext } from "./useContext";

export function useUser(): Ref<User | null> {
    const context = useContext()
    return computed(() => context.value.user);
}

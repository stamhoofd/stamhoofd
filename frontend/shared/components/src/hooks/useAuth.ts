import { ContextPermissions } from "@stamhoofd/networking";
import { useContext } from "./useContext";

export function useAuth(): ContextPermissions {
    const context = useContext()
    return context.value.auth;
}

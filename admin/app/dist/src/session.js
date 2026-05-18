import { randomBytes } from "node:crypto";
const TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();
export function createSession() {
    const id = randomBytes(32).toString("hex");
    sessions.set(id, Date.now() + TTL_MS);
    return id;
}
export function isValid(id) {
    if (!id)
        return false;
    const expiresAt = sessions.get(id);
    if (!expiresAt)
        return false;
    if (expiresAt < Date.now()) {
        sessions.delete(id);
        return false;
    }
    return true;
}
export function destroy(id) {
    if (id)
        sessions.delete(id);
}
//# sourceMappingURL=session.js.map
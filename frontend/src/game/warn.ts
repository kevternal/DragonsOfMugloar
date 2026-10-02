/** Dev-only registry-miss warning naming the field and value (CAP-9). */
export function warnUnlisted(field: string, value: unknown): void {
    if (import.meta.env.DEV) {
        console.warn(
            `[mugloar] Unlisted ${field}: ${JSON.stringify(value)}. Add it to observed-values.md.`,
        )
    }
}

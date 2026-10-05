// Field and value pairs already reported, so a recomputed view doesn't repeat them.
const reported = new Set<string>()

/** Dev-only registry-miss warning naming the field and value, once per pair (CAP-9). */
export function warnUnlisted(field: string, value: unknown): void {
    if (!import.meta.env.DEV) {
        return
    }

    const key = `${field}\u0000${JSON.stringify(value)}`
    if (reported.has(key)) {
        return
    }

    reported.add(key)
    console.warn(
        `[mugloar] Unlisted ${field}: ${JSON.stringify(value)}. Add it to observed-values.md.`,
    )
}

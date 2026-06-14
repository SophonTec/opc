// ---------------------------------------------------------------------------
// Recurrence helpers
//
// Kept in a plain (non-"use server") module so the synchronous helper can be
// imported by both server actions and client code. Server Action modules
// ("use server") may only export async functions, so this logic lives here.
// ---------------------------------------------------------------------------

/**
 * Parse a simple recur_rule string and compute the next due date.
 *
 * Supported formats (case-insensitive):
 *   "every N days"    — add N days
 *   "every N weeks"   — add N*7 days
 *   "every N months"  — add N months
 *   "every N years"   — add N years
 *
 * Falls back to adding 30 days for unrecognised rules.
 */
export function computeNextDueAt(from: Date, recurRule: string): Date {
  const rule = recurRule.trim().toLowerCase()
  const next = new Date(from)

  const match = rule.match(/^every\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/)
  if (match) {
    const n = parseInt(match[1], 10)
    const unit = match[2]
    if (unit.startsWith("day")) {
      next.setDate(next.getDate() + n)
    } else if (unit.startsWith("week")) {
      next.setDate(next.getDate() + n * 7)
    } else if (unit.startsWith("month")) {
      next.setMonth(next.getMonth() + n)
    } else if (unit.startsWith("year")) {
      next.setFullYear(next.getFullYear() + n)
    }
  } else {
    // fallback: 30 days
    next.setDate(next.getDate() + 30)
  }

  return next
}

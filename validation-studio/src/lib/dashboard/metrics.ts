import { DashboardRun } from "@/app/api/dashboard/route"

export interface AggregatedMetric {
    precision: number | null
    recall: number | null
    tp: number
    fp: number
    fn: number
}

export interface DashboardMetrics {
    global: AggregatedMetric
    perModule: Record<string, AggregatedMetric>
}

function safeRatio(numerator: number, denominator: number): number | null {
    if (denominator === 0) return null
    return numerator / denominator
}

/**
 * Aggregate precision & recall from a list of runs by summing TP/FP/FN,
 * then deriving combined scores (more accurate than averaging averages).
 */
export function computeDashboardMetrics(runs: DashboardRun[]): DashboardMetrics {
    let totalTp = 0
    let totalFp = 0
    let totalFn = 0

    const moduleAccum: Record<string, { tp: number; fp: number; fn: number }> = {}

    for (const run of runs) {
        // Global
        if (run.metrics) {
            totalTp += run.metrics.tp ?? 0
            totalFp += run.metrics.fp ?? 0
            totalFn += run.metrics.fn ?? 0
        }

        // Per module
        if (run.moduleMetrics) {
            for (const [mod, m] of Object.entries(run.moduleMetrics)) {
                if (!moduleAccum[mod]) moduleAccum[mod] = { tp: 0, fp: 0, fn: 0 }
                moduleAccum[mod].tp += m.tp ?? 0
                moduleAccum[mod].fp += m.fp ?? 0
                moduleAccum[mod].fn += m.fn ?? 0
            }
        }
    }

    const global: AggregatedMetric = {
        tp: totalTp,
        fp: totalFp,
        fn: totalFn,
        precision: safeRatio(totalTp, totalTp + totalFp),
        recall: safeRatio(totalTp, totalTp + totalFn),
    }

    const perModule: Record<string, AggregatedMetric> = {}
    for (const [mod, acc] of Object.entries(moduleAccum)) {
        perModule[mod] = {
            tp: acc.tp,
            fp: acc.fp,
            fn: acc.fn,
            precision: safeRatio(acc.tp, acc.tp + acc.fp),
            recall: safeRatio(acc.tp, acc.tp + acc.fn),
        }
    }

    return { global, perModule }
}

/** Filter runs by date preset or custom date */
export function filterRunsByDate(runs: DashboardRun[], preset: string, customDate?: Date): DashboardRun[] {
    if (preset === "all") return runs
    const now = new Date()

    if (preset === "custom" && customDate) {
        const start = new Date(customDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(customDate)
        end.setHours(23, 59, 59, 999)
        return runs.filter((r) => {
            const d = new Date(r.timestamp)
            return d >= start && d <= end
        })
    }

    if (preset === "today") {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        return runs.filter((r) => new Date(r.timestamp) >= start)
    }
    if (preset === "last_7") {
        const start = new Date(now)
        start.setDate(start.getDate() - 7)
        return runs.filter((r) => new Date(r.timestamp) >= start)
    }
    if (preset === "last_30") {
        const start = new Date(now)
        start.setDate(start.getDate() - 30)
        return runs.filter((r) => new Date(r.timestamp) >= start)
    }
    return runs
}

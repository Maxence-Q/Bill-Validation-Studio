import { computeDistributionSlices } from "../distributionSnapshot"
import { EvaluationRun } from "../evaluationHistory"

// Unit tests for distributionSnapshot.ts — runnable with `npx tsx`:
// npx tsx src/lib/dashboard/__tests__/distributionSnapshot.test.ts

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RUNS: EvaluationRun[] = [
    {
        id: "run-1",
        timestamp: "2026-02-27T10:00:00Z",
        status: "success",
        typeModuleMetrics: {
            "Event": {
                "string": { tp: 10, fp: 2, fn: 0, precision: 1, recall: 1 },
                "date": { tp: 5, fp: 1, fn: 2, precision: 1, recall: 1 }
            },
            "Prices": {
                "string": { tp: 20, fp: 5, fn: 1, precision: 1, recall: 1 }
            }
        }
    },
    {
        id: "run-2",
        timestamp: "2026-02-27T11:00:00Z",
        status: "success",
        typeModuleMetrics: {
            "Event": {
                "string": { tp: 12, fp: 4, fn: 0, precision: 1, recall: 1 },
                "date": { tp: 5, fp: 3, fn: 2, precision: 1, recall: 1 }
            }
        }
    }
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✓ ${message}`)
        passed++
    } else {
        console.error(`  ✗ FAIL: ${message}`)
        failed++
    }
}

function assertClose(a: number | null | undefined, b: number, message: string, tol = 0.001) {
    const ok = a !== null && a !== undefined && Math.abs(a - b) < tol
    assert(ok, `${message} (got ${a?.toFixed(4)}, expected ~${b.toFixed(4)})`)
}

// ─── Test: computeDistributionSlices ─────────────────────────────────────────

console.log("\n=== computeDistributionSlices ===")

{
    // Test 1: average false positives by perturbation type for Event module
    const slices = computeDistributionSlices(MOCK_RUNS, ["Event"], [], "fp", "avg")

    // run-1 Event fp amounts: string=2, date=1
    // run-2 Event fp amounts: string=4, date=3
    // avg string = (2+4)/2 = 3
    // avg date = (1+3)/2 = 2
    // total = 5
    // percent string = 3/5 = 0.6
    // percent date = 2/5 = 0.4

    assert(slices.length === 2, "Returns 2 slices (string and date)")

    const stringSlice = slices.find(s => s.category === "string")
    assert(stringSlice !== undefined, "Contains string slice")
    assert(stringSlice!.value === 3, "String slice avg value is 3")
    assertClose(stringSlice!.percent, 0.6, "String slice percent is 60%")

    const dateSlice = slices.find(s => s.category === "date")
    assert(dateSlice !== undefined, "Contains date slice")
    assert(dateSlice!.value === 2, "Date slice avg value is 2")
    assertClose(dateSlice!.percent, 0.4, "Date slice percent is 40%")
}

{
    // Test 2: filtering by perturbation type
    const slices = computeDistributionSlices(MOCK_RUNS, ["Event"], ["string"], "fp", "avg")

    assert(slices.length === 1, "Returns exactly 1 slice")
    assert(slices[0].category === "string", "Slice is 'string'")
    assert(slices[0].value === 3, "String value is 3")
    assert(slices[0].percent === 1, "String percent is 100%")
}

{
    // Test 3: aggregation = sum (none)
    const slices = computeDistributionSlices(MOCK_RUNS, ["Event"], [], "fp", null)

    // sum string = 2 + 4 = 6
    // sum date = 1 + 3 = 4
    // total = 10
    // percent string = 6/10 = 0.6
    const stringSlice = slices.find(s => s.category === "string")
    assert(stringSlice!.value === 6, "String slice sum value is 6")
    assertClose(stringSlice!.percent, 0.6, "String slice percent is 60%")
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)

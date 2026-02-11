"use client"

export function ReadyToLaunch() {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-300 px-8">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                </svg>
            </div>
            <div>
                <h3 className="text-xl font-bold mb-1">Ready to Launch</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Perturbations configured. Click <span className="font-semibold text-foreground">Run Evaluation</span> to inject perturbations and send prompts to the LLM.
                </p>
            </div>
        </div>
    )
}

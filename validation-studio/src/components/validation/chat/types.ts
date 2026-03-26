import { ValidationIssue } from "@/types/validation"

export type FeedbackAction = 'fixed' | 'dismissed'
export type FeedbackMap = Record<string, FeedbackAction>

export interface IssueCardProps {
    issue: ValidationIssue
    feedback?: FeedbackAction
    onAction: (issueId: string, action: FeedbackAction) => void
}

export interface ListModuleIssuesProps {
    issues: ValidationIssue[]
    feedbackMap: FeedbackMap
    onAction: (issueId: string, action: FeedbackAction) => void
}

export interface ModuleMessageProps {
    entry: {
        module: string
        issues: ValidationIssue[]
    }
    index: number
    feedbackMap: FeedbackMap
    onAction: (issueId: string, action: FeedbackAction) => void
}

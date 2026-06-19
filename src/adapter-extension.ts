import type {
  RunAdapterScore,
  RunBundle,
  RunFeedbackCandidate
} from "./run.js";

export type BrowserAdapterBackend =
  | "cua"
  | "shared-world"
  | "concurrent-shared-world";

/**
 * Product-agnostic scoring context for browser/computer-use lanes. Product-specific
 * evidence/rubrics stay in the adopter's repo; core provides the assembled bundle
 * plus stable run identifiers and never learns product nouns.
 */
export interface BrowserLabScoringContext {
  bundle: RunBundle;
  labId: string;
  runId: string;
  actor: string;
  backend: BrowserAdapterBackend;
  dryRun: boolean;
  laneCount: number;
}

export interface BrowserLabAdapterHooks {
  /**
   * Browser-route extension seam (#165): a thin adapter may score the assembled
   * browser/shared-world evidence without forking core. The score is stored as
   * namespaced `bundle.adapterScore`; product-specific component detail belongs
   * in `data`, not in core enums or review text.
   */
  score?: (ctx: BrowserLabScoringContext) => RunAdapterScore | Promise<RunAdapterScore>;
  /**
   * Companion seam for public-safe, adapter-namespaced feedback candidates.
   * Malformed candidates are dropped before bundle persistence so core remains
   * verifiable even when an adapter misbehaves.
   */
  deriveFeedback?: (ctx: BrowserLabScoringContext) => RunFeedbackCandidate[] | Promise<RunFeedbackCandidate[]>;
}

export async function applyBrowserAdapterHooks(args: {
  hooks: BrowserLabAdapterHooks | undefined;
  context: BrowserLabScoringContext;
  bundle: RunBundle;
  sanitize: (text: string) => string;
  warnings: string[];
  hookLabel: string;
}): Promise<void> {
  const { hooks, context, bundle, sanitize, warnings, hookLabel } = args;
  if (!hooks?.score && !hooks?.deriveFeedback) return;

  const scrubValue = <T>(value: T): T => {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? value : JSON.parse(sanitize(encoded)) as T;
  };

  if (hooks.score) {
    try {
      const score = await hooks.score(context);
      const cleaned = scrubValue(score);
      if (isAdapterScoreShape(cleaned)) {
        bundle.adapterScore = cleaned;
        applyAdapterScoreFailureToReview(bundle);
      } else {
        warnings.push(`${hookLabel}.score returned a value that is not a well-formed mimetic.adapter-score.v1 (non-empty namespace + status + numeric score + summary); dropped so the bundle stays verifiable.`);
      }
    } catch (error) {
      warnings.push(`${hookLabel}.score threw (${sanitize(error instanceof Error ? error.message : String(error))}); dropped so the bundle stays verifiable.`);
    }
  }

  if (hooks.deriveFeedback) {
    try {
      const candidates = await hooks.deriveFeedback(context);
      const accepted: RunFeedbackCandidate[] = [];
      for (const candidate of Array.isArray(candidates) ? candidates : []) {
        const cleaned = scrubValue(candidate);
        if (isAdapterFeedbackCandidateShape(cleaned)) accepted.push(cleaned);
        else warnings.push(`${hookLabel}.deriveFeedback returned a candidate that is not a well-formed mimetic.feedback-candidate.v1 (or its adapter block lacked a non-empty namespace + data record); dropped so the bundle stays verifiable.`);
      }
      if (accepted.length > 0) {
        bundle.feedbackCandidates = [...bundle.feedbackCandidates, ...accepted];
      }
    } catch (error) {
      warnings.push(`${hookLabel}.deriveFeedback threw (${sanitize(error instanceof Error ? error.message : String(error))}); dropped so the bundle stays verifiable.`);
    }
  }
}

export function adapterScoreFailureMessage(bundle: RunBundle): string | undefined {
  return bundle.adapterScore?.status === "fail"
    ? `Adapter scorer failed the run: ${bundle.adapterScore.summary}`
    : undefined;
}

export function applyAdapterScoreFailureToReview(bundle: RunBundle): string | undefined {
  const message = adapterScoreFailureMessage(bundle);
  if (message === undefined) return undefined;

  if (bundle.review.verdict === "pass" || bundle.review.verdict === "contract_proof_only") {
    bundle.review.verdict = "fail";
    bundle.review.summary = message;
  }
  if (!bundle.review.gaps.includes(message)) {
    bundle.review.gaps = [...bundle.review.gaps, message];
  }
  return message;
}

function isAdapterScoreShape(value: unknown): value is RunAdapterScore {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && (value as RunAdapterScore).schema === "mimetic.adapter-score.v1"
    && typeof (value as RunAdapterScore).namespace === "string"
    && (value as RunAdapterScore).namespace.trim().length > 0
    && ["pass", "partial", "fail"].includes((value as RunAdapterScore).status)
    && typeof (value as RunAdapterScore).score === "number"
    && Number.isFinite((value as RunAdapterScore).score)
    && typeof (value as RunAdapterScore).summary === "string"
    && ((value as RunAdapterScore).data === undefined
      || (typeof (value as RunAdapterScore).data === "object"
        && (value as RunAdapterScore).data !== null
        && !Array.isArray((value as RunAdapterScore).data)));
}

function isAdapterFeedbackCandidateShape(value: unknown): value is RunFeedbackCandidate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Partial<RunFeedbackCandidate>;
  const baseOk = candidate.schema === "mimetic.feedback-candidate.v1"
    && typeof candidate.id === "string"
    && typeof candidate.summary === "string"
    && candidate.summary.trim().length > 0
    && Array.isArray(candidate.evidence)
    && typeof candidate.redaction === "object"
    && candidate.redaction !== null
    && candidate.redaction.status === "passed";
  if (!baseOk) return false;
  if (candidate.adapter !== undefined) {
    const adapter = candidate.adapter;
    if (typeof adapter !== "object" || adapter === null
      || typeof adapter.namespace !== "string" || adapter.namespace.trim().length === 0
      || typeof adapter.data !== "object" || adapter.data === null || Array.isArray(adapter.data)) {
      return false;
    }
  }
  return true;
}

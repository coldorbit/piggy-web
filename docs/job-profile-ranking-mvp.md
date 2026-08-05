# Job-profile ranking MVP

The MVP adds opt-in, profile-specific ordering to the Bid workspace without changing the default newest-job feed.

## User flow

1. Open the Bid workspace and select a profile.
2. Open Filters.
3. Select **Recommended for profile** under Sort.
4. Review the `MVP fit` score and hover or focus it to see the leading match reasons.

The score is a ranking signal, not a calibrated probability of receiving an interview.

## Current scorer

Model version: `baseline-keyword-v1`

The explainable baseline combines:

- resume and job-description token overlap;
- target-title alignment;
- profile specialization and job classification;
- seniority alignment;
- remote-work preference alignment; and
- listing freshness.

The API ranks up to the 500 newest eligible candidates that pass the existing job and Bid-tab filters. The response reports when this MVP candidate set is truncated.

## Persistence and learning data

- `job_profile_scores` stores versioned component scores, reasons, input fingerprints, and scoring timestamps.
- `ranking_impressions` records the jobs actually shown, their display positions, scores, and model versions.
- Existing `job_bids` and `interviews` provide downstream application and interview outcomes.

The impression endpoint is:

```text
POST /api/bid/ranking-impressions
```

Request IDs make impression writes idempotent for a returned ranking page.

## Safety and fallback

- Recommended ordering is opt-in.
- The existing recency sort remains the default and fallback.
- Contact fields and candidate names are not ranking inputs.
- Scores and impressions are scoped through the existing profile-access checks.

## BGE/GPU boundary

The product contract is deliberately model-independent: `match.score`, `match.components`, `match.reasons`, and `match.modelVersion` can be produced by the current baseline or a future model.

The next model iteration should:

1. add a separate Python ranking worker;
2. embed sanitized profile and job documents with `BAAI/bge-small-en-v1.5`;
3. store versioned embeddings;
4. add embedding similarity to the ranking components;
5. train a weekly LightGBM ranker from matured application outcomes; and
6. periodically fine-tune the encoder on a temporary GPU, backfill embeddings beside the current version, and switch versions only after evaluation.

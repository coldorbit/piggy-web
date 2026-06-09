# Interview and Caller Marketplace Workflow

## Concept

This marketplace connects two user groups through an internal managed process:

- Interview owners have interview opportunities and need callers.
- Caller owners have caller capacity and need interview opportunities.
- The internal team reviews, matches, schedules, monitors, and closes each match.
- Interview owners and caller owners should not directly contact each other through the platform.

## Diagram 1: Marketplace Overview

```mermaid
flowchart LR
  interviewOwner[Interview Owner<br/>Has interviews<br/>Needs callers]
  callerOwner[Caller Owner<br/>Has callers<br/>Needs interviews]
  platform[Platform Marketplace]
  internalTeam[Internal Team<br/>Review, match, control process]
  match[Controlled Match]
  outcome[Interview Outcome<br/>Completed, next round, offer, rejected]
  payout[Offer and Payment Tracking]

  interviewOwner --> platform
  callerOwner --> platform
  platform --> internalTeam
  internalTeam --> match
  match --> outcome
  outcome --> payout

  internalTeam -. controls communication .- interviewOwner
  internalTeam -. controls communication .- callerOwner
  interviewOwner x-. no direct contact .-x callerOwner
```

## Diagram 2: End-to-End Business Workflow

```mermaid
flowchart TD
  start[User joins platform]
  role{User role}

  interviewProfile[Interview Owner Profile]
  callerProfile[Caller Owner Profile]
  review[Internal Team Review]
  approved{Approved?}
  rejected[Rejected or Needs More Info]

  submitInterview[Submit Interview Opportunity]
  submitCaller[Submit Caller Capacity]
  reviewAssets[Internal Review of Interviews and Callers]

  matchmaking[Internal Matchmaking]
  proposed[Potential Match Proposed Internally]
  callerConfirm[Confirm Caller Availability]
  interviewConfirm[Confirm Interview Details]
  confirmed{Both sides confirmed?}

  schedule[Internal Team Schedules Interview]
  execute[Interview / Call Execution]
  track[Track Outcome]
  offer{Offer received?}
  payment[Offer, Fee, and Payout Tracking]
  close[Close Match]

  start --> role
  role -->|Has interviews| interviewProfile
  role -->|Has callers| callerProfile
  role -->|Both| interviewProfile
  role -->|Both| callerProfile

  interviewProfile --> review
  callerProfile --> review
  review --> approved
  approved -->|No| rejected
  approved -->|Yes| submitInterview
  approved -->|Yes| submitCaller

  submitInterview --> reviewAssets
  submitCaller --> reviewAssets
  reviewAssets --> matchmaking
  matchmaking --> proposed
  proposed --> callerConfirm
  proposed --> interviewConfirm
  callerConfirm --> confirmed
  interviewConfirm --> confirmed
  confirmed -->|No| matchmaking
  confirmed -->|Yes| schedule
  schedule --> execute
  execute --> track
  track --> offer
  offer -->|Yes| payment
  offer -->|No| close
  payment --> close
```

## Diagram 3: Internal Matchmaking Process

```mermaid
flowchart TD
  queue[Approved Interview Queue]
  callerPool[Approved Caller Pool]
  matchingDashboard[Internal Matching Dashboard]

  fitScore[Evaluate Match Fit]
  riskCheck[Risk and Conflict Check]
  termsCheck[Compensation and Terms Check]
  availabilityCheck[Availability Check]

  internalDecision{Internal Team Approves Match?}
  rejectMatch[Reject Match<br/>Return to Queue]
  reserveMatch[Reserve Candidate Match]
  confirmCaller[Confirm with Caller Owner]
  confirmInterview[Confirm with Interview Owner]
  finalDecision{Ready to Schedule?}
  schedule[Schedule Match]

  queue --> matchingDashboard
  callerPool --> matchingDashboard
  matchingDashboard --> fitScore
  fitScore --> riskCheck
  riskCheck --> termsCheck
  termsCheck --> availabilityCheck
  availabilityCheck --> internalDecision

  internalDecision -->|No| rejectMatch
  rejectMatch --> matchingDashboard

  internalDecision -->|Yes| reserveMatch
  reserveMatch --> confirmCaller
  reserveMatch --> confirmInterview
  confirmCaller --> finalDecision
  confirmInterview --> finalDecision

  finalDecision -->|No| matchingDashboard
  finalDecision -->|Yes| schedule
```

## Diagram 4: Communication Control

```mermaid
sequenceDiagram
  participant IO as Interview Owner
  participant Admin as Internal Team
  participant CO as Caller Owner
  participant System as Platform

  IO->>System: Submit interview details
  CO->>System: Submit caller profile and availability
  System->>Admin: Show review and match queues
  Admin->>IO: Ask clarifying questions if needed
  Admin->>CO: Confirm caller fit and availability
  CO-->>Admin: Respond with controlled details
  IO-->>Admin: Confirm interview details
  Admin->>System: Create match and schedule
  System-->>IO: Show limited match status
  System-->>CO: Show limited assignment status
  Admin->>System: Record outcome and payment status

  Note over IO,CO: No direct messaging, no exposed contact info, no uncontrolled meeting links.
```

## Diagram 5: Status Model

```mermaid
stateDiagram-v2
  [*] --> Submitted
  Submitted --> UnderReview
  UnderReview --> NeedsMoreInfo
  NeedsMoreInfo --> UnderReview
  UnderReview --> Rejected
  UnderReview --> Approved
  Approved --> Matching
  Matching --> Matched
  Matched --> PendingConfirmations
  PendingConfirmations --> Matching: confirmation failed
  PendingConfirmations --> Scheduled
  Scheduled --> InProgress
  Scheduled --> Cancelled
  InProgress --> Completed
  InProgress --> Failed
  Completed --> OfferPending
  Completed --> Closed
  OfferPending --> OfferConfirmed
  OfferPending --> Closed
  OfferConfirmed --> PaymentTracking
  PaymentTracking --> Closed
  Rejected --> [*]
  Cancelled --> [*]
  Failed --> [*]
  Closed --> [*]
```

## Key Platform Modules

### Admin Modules

- User review queue
- Interview opportunity review queue
- Caller profile and availability queue
- Matchmaking dashboard
- Match detail page
- Scheduling controls
- Internal notes
- Risk flags
- Outcome tracking
- Offer and payment tracking

### Interview Owner Modules

- Submit interview opportunity
- View interview review status
- View matching status
- View scheduled interview status
- Submit questions or updates to internal team
- View final outcome when approved by internal team

### Caller Owner Modules

- Submit caller profile
- Submit availability
- View approved assignments
- Confirm availability
- View schedule
- Submit post-interview notes
- View payout status

## Suggested Data Objects

### User

- ID
- Name
- Email
- Role: interview owner, caller owner, both, internal admin
- Review status
- Risk status
- Internal notes

### Interview Opportunity

- ID
- Interview owner ID
- Job title
- Company
- Interview stage
- Interview format
- Time zone
- Availability windows
- Required caller skills
- Budget or compensation terms
- Notes
- Review status
- Match status

### Caller Profile

- ID
- Caller owner ID
- Caller label or name
- Skills
- Languages
- Experience
- Time zone
- Availability windows
- Preferred job categories
- Rate expectation
- Review status
- Availability status
- Performance notes

### Match

- ID
- Interview opportunity ID
- Caller profile ID
- Assigned internal owner
- Match status
- Scheduled time
- Meeting link visibility
- Internal notes
- User-visible notes
- Outcome
- Offer status
- Payment status

### Offer / Payment Record

- ID
- Match ID
- Offer amount
- Offer terms
- Platform fee
- Interview owner fee or revenue
- Caller owner payout
- Payment status
- Payout status
- Closed date

## Business Rules

- Users cannot directly browse the opposite marketplace side.
- Interview owners cannot directly message caller owners.
- Caller owners cannot directly message interview owners.
- Contact information must be hidden by default.
- Meeting links should be controlled by the internal team.
- Internal approval is required before a user can participate.
- Internal approval is required before an interview or caller profile becomes matchable.
- Internal approval is required before a match is scheduled.
- Internal team owns final outcome and offer/payment tracking.
- Risk flags should block automatic matching.
- Cancelled, failed, and no-show matches should affect future review decisions.

## MVP Workflow

1. User signs up and selects a role.
2. Internal team reviews and approves the user.
3. Interview owners submit interview opportunities.
4. Caller owners submit caller profiles and availability.
5. Internal team reviews submitted interviews and callers.
6. Internal team creates a match.
7. Internal team confirms both sides separately.
8. Internal team schedules the interview.
9. Internal team records completion and outcome.
10. If there is an offer, internal team tracks payment and payout.
11. Internal team closes the match.

## Later Enhancements

- Match score calculation
- Availability calendar integration
- Internal-only chat history
- User-visible sanitized message relay
- Caller performance scoring
- Interview owner reliability scoring
- Automated conflict checks
- Same-company duplicate checks
- Payment provider integration
- Admin audit log
- Offer pipeline analytics
- Marketplace liquidity dashboard

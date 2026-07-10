# Profile Intelligence Hub

The Profile Intelligence Hub turns each application profile into a reusable interview-preparation workspace.

## User flow

1. Open **Profiles** and select a profile card.
2. Complete the candidate narrative on **Overview**.
3. Add four to six evidence-backed examples on **Career Story**.
4. Score the Staff+ ML rubric and record practice priorities on **Interview Prep**.
5. Save city, state/region, country, timezone, and sourced community facts on **Location Context**.
6. Open the same preparation view from an interview's **Profile prep** action.

## Data boundaries

- `bid_profiles` remains the application and resume identity record.
- `profile_intelligence` stores target-role, locality, work-preference, and regional-context fields.
- `profile_stories` stores candidate-approved career evidence.
- `profile_prep_plans` stores Staff+ ML readiness scores and practice priorities.
- Street addresses submitted for U.S. Census lookup are never written to the database.
- Coordinates are rounded to two decimal places before storage.
- Superadmins and internal users can open the Profile Hub.
- Admins can open the Profile Hub only when a superadmin grants the persisted **Profile Hub access** entitlement in user management.
- Users, finance managers, guests, callers, and bidder roles cannot open Profile Hub routes or APIs.
- Non-entitled users retain the existing read-only profile dialog where their normal profile permissions allow it.
- Only the profile owner or an administrator can change intelligence, stories, preparation plans, or location context.

## Address lookup

The automatic lookup endpoint currently supports U.S. addresses through the U.S. Census Geocoder:

```text
POST /api/bid/profiles/:profileId/location/geocode
```

The request body contains `address` and `countryCode`. The server sends the address directly to the provider and saves only locality metadata, rounded coordinates, provider name, confidence, and verification time. Non-U.S. locality data can be entered manually.

## API surface

```text
GET    /api/bid/profiles/:profileId/hub
PATCH  /api/bid/profiles/:profileId/intelligence
POST   /api/bid/profiles/:profileId/location/geocode
POST   /api/bid/profiles/:profileId/stories
PATCH  /api/bid/profiles/:profileId/stories/:storyId
DELETE /api/bid/profiles/:profileId/stories/:storyId
PATCH  /api/bid/profiles/:profileId/prep-plan
```

Tables are created by the existing `ensureWebModels()` startup synchronization.

## Production follow-ups

- Add a commercial provider behind the geocoding service interface if international street-address lookup is required.
- Move the seeded Staff+ ML playbook into a versioned knowledge-article editor when non-developers need to publish content.
- Add audit events for reads of sensitive profile fields before storing any higher-precision location data.
- Keep candidate stories human-approved before using them in generated interview answers.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  geocodeUsResidentAddress,
  profileIntelligenceAttributesFromBody,
  profilePrepAttributesFromBody,
  profileStoryAttributesFromBody,
  readinessForProfile,
} from '../server/modules/bidding/application/profileIntelligenceService.js';

describe('profile intelligence validation', () => {
  it('normalizes structured profile intelligence', () => {
    const attrs = profileIntelligenceAttributesFromBody({
      targetLevel: 'STAFF',
      targetTitles: ['ML Engineer', ' ML Engineer ', 'Staff MLE'],
      specializations: 'ranking, recommendations',
      countryCode: 'us',
      timezone: 'America/Los_Angeles',
      remotePreference: 'hybrid',
      relocationPreference: 'case_by_case',
      regionalContextSources: ['https://www.census.gov/'],
    });

    assert.equal(attrs.targetLevel, 'staff');
    assert.deepEqual(attrs.targetTitles, ['ML Engineer', 'Staff MLE']);
    assert.deepEqual(attrs.specializations, ['ranking', 'recommendations']);
    assert.equal(attrs.countryCode, 'US');
    assert.equal(attrs.regionalContextSources[0].url, 'https://www.census.gov/');
  });

  it('rejects invalid timezone and source values', () => {
    assert.throws(() => profileIntelligenceAttributesFromBody({ timezone: 'Pacific-ish' }), /valid IANA timezone/);
    assert.throws(
      () => profileIntelligenceAttributesFromBody({ regionalContextSources: ['javascript:alert(1)'] }),
      /valid HTTP or HTTPS URLs/,
    );
  });
});

describe('profile story and preparation validation', () => {
  it('requires a title and restricts verification status', () => {
    assert.throws(() => profileStoryAttributesFromBody({}), /title is required/);
    assert.throws(() => profileStoryAttributesFromBody({ title: 'A project', verificationStatus: 'approved' }), /draft or verified/);
  });

  it('only accepts readiness scores from zero to three', () => {
    assert.throws(
      () => profilePrepAttributesFromBody({ competencyScores: { mlSystemDesign: 4 } }),
      /0 to 3/,
    );
    assert.deepEqual(
      profilePrepAttributesFromBody({ competencyScores: { mlSystemDesign: 2, ignored: 3 } }).competencyScores,
      { mlSystemDesign: 2 },
    );
  });

  it('computes readiness from narrative, location, verified stories, and rubric scores', () => {
    const readiness = readinessForProfile({
      intelligence: {
        targetLevel: 'staff',
        professionalSummary: 'Summary',
        targetTitles: ['Staff MLE'],
        specializations: ['ranking'],
        city: 'Seattle',
        region: 'WA',
        countryCode: 'US',
        timezone: 'America/Los_Angeles',
      },
      stories: Array.from({ length: 4 }, (_, id) => ({ id, verificationStatus: 'verified' })),
      prepPlan: {
        competencyScores: {
          technicalStrategy: 2,
          mlSystemDesign: 3,
          modelingAndExperimentation: 2,
          productionReliability: 2,
          responsibleAi: 2,
          productJudgment: 2,
          crossFunctionalInfluence: 2,
          executionAndLearning: 2,
        },
      },
    });

    assert.equal(readiness.percent, 100);
  });
});

describe('resident address geocoding', () => {
  it('rounds coordinates and returns locality metadata without returning the submitted address', async () => {
    const result = await geocodeUsResidentAddress('1600 Pennsylvania Avenue NW, Washington, DC 20500', {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          result: {
            addressMatches: [{
              matchedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
              coordinates: { x: -77.0365298, y: 38.8976763 },
              addressComponents: { city: 'WASHINGTON', state: 'DC', zip: '20500' },
            }],
          },
        }),
      }),
    });

    assert.equal(result.coarseLatitude, 38.9);
    assert.equal(result.coarseLongitude, -77.04);
    assert.equal(result.city, 'WASHINGTON');
    assert.equal(result.region, 'DC');
    assert.equal(result.locationProvider, 'US Census Geocoder');
  });
});

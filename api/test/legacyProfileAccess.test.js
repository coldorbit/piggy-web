import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ensureProfileBidEligible } from '../server/modules/bidding/presentation/biddingQueriesController.js';

describe('legacy profile access', () => {
  it('allows reading past applications for interview registration', () => {
    const res = rejectingResponse();

    assert.equal(
      ensureProfileBidEligible({ profileStatus: 'legacy' }, res, { allowPastApplications: true }),
      true,
    );
    assert.equal(res.statusCode, null);
  });

  it('continues to reject new bidding and tailoring work', () => {
    const res = rejectingResponse();

    assert.equal(ensureProfileBidEligible({ profileStatus: 'legacy' }, res), false);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /cannot be used for bidding or tailoring/);
  });
});

function rejectingResponse() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

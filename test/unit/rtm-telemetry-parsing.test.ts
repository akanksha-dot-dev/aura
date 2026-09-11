import { describe, it, expect } from 'vitest';

describe('In-stream bracket tag telemetry parsing patterns', () => {
  const FACT_REGEX = /\[LOG_FACT:\s*([^|\]]+?)(?:\s*\|\s*(\d+))?(?:\s*\|\s*([^\]]+?))?\]/i;
  const HYPO_REGEX = /\[LOG_HYPOTHESIS:\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?(?:\s*\|\s*(\d+))?\]/i;
  const CONFLICT_REGEX = /\[LOG_CONFLICT:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\]/i;
  const RESOLVE_CONFLICT_REGEX = /\[RESOLVE_CONFLICT:\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\]/i;
  const DECISION_REGEX = /\[LOG_DECISION:\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\]/i;
  const ACTION_REGEX = /\[LOG_ACTION:\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?(?:\s*\|\s*([^\]]+?))?\]/i;
  const COMPLETE_ACTION_REGEX = /\[COMPLETE_ACTION:\s*([^|\]]+?)\]/i;

  it('correctly matches and parses LOG_FACT tags', () => {
    const text = '[LOG_FACT: Checkout error rate is 45% | 85 | checkout-service] We are seeing elevated errors.';
    const match = text.match(FACT_REGEX);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('Checkout error rate is 45%');
    expect(Number(match![2])).toBe(85);
    expect(match![3].trim()).toBe('checkout-service');
  });

  it('correctly matches and parses LOG_HYPOTHESIS tags', () => {
    const text = '[LOG_HYPOTHESIS: DB connection pool exhaustion | pg_stat_activity | 75] Investigating connection leak.';
    const match = text.match(HYPO_REGEX);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('DB connection pool exhaustion');
    expect(match![2].trim()).toBe('pg_stat_activity');
    expect(Number(match![3])).toBe(75);
  });

  it('correctly matches and parses LOG_CONFLICT tags with two hypotheses and deciding metric', () => {
    const text = '[LOG_CONFLICT: DNS Resolution Failure | Database Pool Starvation | DNS response time vs active queries] Team has contradictory theories.';
    const match = text.match(CONFLICT_REGEX);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('DNS Resolution Failure');
    expect(match![2].trim()).toBe('Database Pool Starvation');
    expect(match![3].trim()).toBe('DNS response time vs active queries');
  });

  it('correctly matches and parses RESOLVE_CONFLICT tags', () => {
    const text = '[RESOLVE_CONFLICT: DNS Resolution Failure | DNS verified healthy via dig] DNS is eliminated.';
    const match = text.match(RESOLVE_CONFLICT_REGEX);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('DNS Resolution Failure');
    expect(match![2].trim()).toBe('DNS verified healthy via dig');
  });

  it('correctly matches and parses LOG_DECISION tags', () => {
    const text = '[LOG_DECISION: Roll back PR #492 immediately | Mitigate connection exhaustion] Proceed with rollback.';
    const match = text.match(DECISION_REGEX);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('Roll back PR #492 immediately');
    expect(match![2].trim()).toBe('Mitigate connection exhaustion');
  });

  it('correctly matches and parses LOG_ACTION tags', () => {
    const text = '[LOG_ACTION: Execute kubectl rollback | Bhaskar | 5] Run the rollback command.';
    const match = text.match(ACTION_REGEX);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('Execute kubectl rollback');
    expect(match![2].trim()).toBe('Bhaskar');
    expect(Number(match![3])).toBe(5);
  });

  it('correctly matches and parses COMPLETE_ACTION tags', () => {
    const text = '[COMPLETE_ACTION: Execute kubectl rollback] Rollback completed.';
    const match = text.match(COMPLETE_ACTION_REGEX);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('Execute kubectl rollback');
  });
});

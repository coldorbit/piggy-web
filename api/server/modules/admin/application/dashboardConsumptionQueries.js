export function consumptionBreakdownSql({ periodCte, periodPredicate }) {
  return `
    WITH ${periodCte}
    SELECT
      CASE WHEN consumption_transactions.type = 'card_pay' THEN 'card' ELSE 'crypto' END AS channel,
      consumption_ledger_entries.currency,
      SUM(consumption_ledger_entries.amount)::numeric AS amount,
      COUNT(DISTINCT consumption_transactions.id)::int AS transaction_count
    FROM consumption_transactions
    JOIN consumption_ledger_entries
      ON consumption_ledger_entries.transaction_id = consumption_transactions.id
    JOIN consumption_accounts
      ON consumption_accounts.id = consumption_ledger_entries.account_id
    CROSS JOIN current_period
    WHERE ${periodPredicate}
      AND consumption_ledger_entries.direction = 'outflow'
      AND (
        (
          consumption_transactions.type = 'card_pay'
          AND consumption_accounts.type = 'card'
          AND consumption_ledger_entries.entry_kind = 'principal'
        )
        OR (
          consumption_transactions.type IN ('crypto_spend', 'eth_fee')
          AND consumption_accounts.type = 'crypto_wallet'
          AND consumption_ledger_entries.entry_kind IN ('principal', 'eth_network_fee')
        )
      )
    GROUP BY channel, consumption_ledger_entries.currency
    ORDER BY channel, amount DESC, consumption_ledger_entries.currency
  `;
}

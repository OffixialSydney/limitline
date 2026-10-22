# Calculation reference

All money inside the engine (`src/lib/calculations`) is integer cents. Decimal strings are parsed with string
arithmetic and rounded half away from zero once. The engine is pure: `now` is always passed in.

## Statuses
| Status | Meaning |
|---|---|
| Within limit (`normal`) | Fresh, complete recorded data shows room left and usage is below the warning threshold |
| Approaching limit (`warning`) | Used share of the allowance is at or above your warning threshold (default 80%) |
| Limit reached | The latest observation is at or through the limit |
| Breach recorded | An earlier observation in the evaluated window went through the limit; the account has since recovered |
| Not calculated (`unknown`) | The rule model is custom/unsupported. No model is substituted |
| Data incomplete | Inputs are missing, stale, or contradicted by newer records (see reasons on screen) |

Limit reached and Breach recorded are evidence-based and are still reported when data is stale. A healthy status
(Within limit / Approaching) is never shown on stale or contradicted data.

## Profit target progress
`recorded trading profit ÷ target profit × 100`. Target = amount, or percent × starting balance.
Display is clamped to 0–100%; the raw value is kept ("target exceeded", "below start").
Trading profit excludes deposits, withdrawals, fees, credits and adjustments:
* with observations: `latest balance − starting balance − events dated at or before that observation`
* without observations: sum of recorded net trade results (balance is shown as "derived")
* no records: "Not enough data"

## Overall loss
Allowance = amount, or percent × starting balance.
* Static: threshold = starting balance − allowance
* Trailing: threshold = highest recorded value − allowance (optionally never above the starting balance)
* End-of-day trailing: same, but the peak only uses the last observation of each *completed* day, where days are
  split by the reset timezone/time. Intraday highs are ignored. Needs timezone and reset time.
* Custom: not calculated.
Measure is balance or equity observations, as configured. Remaining = latest value − threshold.

## Daily loss
Reference = balance, equity, or the higher of both from the latest observation at or before the most recent daily
reset (DST-aware, in the reset timezone). Loss = reference − latest balance/equity observed after that reset.
Remaining = allowance − max(loss, 0). Requires: reset timezone + time, a reference observation, and an observation
since the reset.

## Why a result can be "Data incomplete"
* no usable observations, or none since the daily reset
* latest observation older than your freshness window (default 48 h)
* trades or balance events recorded after the latest observation
* trades or events between the daily reference observation and the reset
* missing/invalid timezone or reset time, or an invalid limit value

## Known limitations
* Everything is based on manually entered observations. Nothing is live.
* Intraday peaks and breaches between observations are invisible to Limitline.
* Consistency rules are stored but not evaluated.
* Profit/loss from prices is not computed; trade results are entered by the user.
* The risk calculator needs the user's contract value per price unit and does no currency conversion.
* Alerts are created after writes or when you press "Check recorded data", not continuously.

# Human Queue

## H1 (open, human-action): add the Stripe test key to CI

The checkout test (phase-2-task-5) needs `STRIPE_TEST_KEY` in the CI secrets. The agent cannot set CI secrets. Confirm "done" once the secret is added.

## H2 (open, product-decision): currencies on the pricing page

- Option "usd-only": prices in USD only. Ships this week; visitors outside the US see USD.
- Option "usd-eur": USD and EUR with a switch. Needs EUR prices from finance and one extra task (about a day).
- Default the agent recommends: "usd-only", by the rule "ship the smallest scope first" (D2).

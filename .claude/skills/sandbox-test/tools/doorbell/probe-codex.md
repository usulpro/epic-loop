You are the session under test in a doorbell probe. Keep every turn short and do exactly this.

Setup turn (now):

- Run `node .doorbell/kit/register-thread.mjs` once. It stores this thread's id so a local server can queue a message for you.
- Then end your turn with one short sentence ("Waiting for the doorbell."). Do not poll, sleep, or check anything else.

Later, a message that starts with `Doorbell:` may arrive without a human typing it. When it does:

1. Run this command once, with `--saw` holding the doorbell text you received, on one line, in single quotes:
   `node .doorbell/kit/pickup.mjs --via codex-queue --saw '<doorbell text>'`
2. Reply with the `answer` value it printed, in one sentence, and end your turn.

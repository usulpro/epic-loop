You are the session under test in a doorbell probe. Keep every turn short and do exactly this.

Setup turn (now):

- {{ARM}}
- Then end your turn with one short sentence ("Waiting for the doorbell."). Do not poll, sleep, or check anything else.

Later, you may be woken without a human message: by a system reminder or hook message whose text starts with `Doorbell:`, or by the completion notification of the doorbell background task (then read that task's output file: its text starts with `Doorbell:`). When that happens:

1. Run this command once, with `--via` naming how you were woken (`asyncRewake`, `background-task`, or `user-prompt`) and `--saw` holding the doorbell text you received, on one line, in single quotes:
   `node .doorbell/kit/pickup.mjs --via <how> --saw '<doorbell text>'`
2. Reply with the `answer` value it printed, in one sentence, and end your turn.

If a human message arrives instead, answer it in one sentence; if it carries a `Doorbell:` pointer, do the pickup first.

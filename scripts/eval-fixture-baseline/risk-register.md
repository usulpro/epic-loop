# Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Implementation touches production plugin files instead of the isolated fixture. | Eval run becomes noisy and may create unrelated product diffs. | Every implementation task names `temp/eval-fixture-project` as the surface; reset script clears only the epic baseline and fixture folder. | open |
| Agent commits fixture work in the root repository. | Root history gets polluted or task closure checks become ambiguous. | The tracker requires fixture commits to be made from inside `temp/eval-fixture-project` or with `git -C temp/eval-fixture-project ...`; root repo keeps `temp/` ignored. | open |
| Verification is too shallow and misses broken modules or imports. | The eval may pass even when agent work is incomplete. | Each phase has a concrete `node --test` verification task with expected stdout and behavior evidence. | open |
| Reset deletes too much. | Accidental removal outside the fixture folder or epic workspace. | Reset script uses fixed repository-relative paths and refuses to remove paths outside the repository root. | open |
| Task is too trivial to exercise role handoff and status transitions. | The eval may not cover enough loop behavior. | Roadmap includes multiple implementation tasks across two phases plus verification. | open |

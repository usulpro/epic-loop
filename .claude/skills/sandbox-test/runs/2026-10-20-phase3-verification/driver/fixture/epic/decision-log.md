# Decision Log

## D2 (human): ship the smallest scope first

When a choice adds scope without blocking launch, ship the smaller option and log the larger one as a follow-up.

## D7 (agent-made, unconfirmed): system font stack instead of a web font

The landing page uses the system font stack instead of loading Inter from a font CDN. It saves about 90 KB and one network request; the headings look slightly different on Windows. Reversing it means adding the font files and one task.

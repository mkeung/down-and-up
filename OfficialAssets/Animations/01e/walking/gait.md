# Walking gait review

The revised walk uses eight independently drawn poses from a shared reference canvas. It replaces the original cycle in which the nearer golden hind leg remained almost planted and front/hind movement was not coordinated. The active `../sources/walking-v3.png` retains these leg phases and adds a broad wag in all three tails. The preceding gait sheet is preserved at `../sources/walking-v2-sheet.png`, and the earliest sheet at `../sources/walking.png`.

Near/far refer to the foreground/background legs, not screen left/right. Both front legs are tabby; both hind legs are golden. Paws on the far side use a slightly higher ground line to match the three-quarter view.

| Frame | Near front   | Far front    | Near hind    | Far hind     |
| ----- | ------------ | ------------ | ------------ | ------------ |
| 1     | Contact      | Push         | Mid stance   | Swing        |
| 2     | Early stance | Lift         | Late stance  | Reach        |
| 3     | Mid stance   | Swing        | Push         | Contact      |
| 4     | Late stance  | Reach        | Lift         | Early stance |
| 5     | Push         | Contact      | Swing        | Mid stance   |
| 6     | Lift         | Early stance | Reach        | Late stance  |
| 7     | Swing        | Mid stance   | Contact      | Push         |
| 8     | Reach        | Late stance  | Early stance | Lift         |

This is the pose plan used for generation and visual review. Generated paw positions are approximate, not mathematically interpolated. Contact poses alternate near front → far hind → far front → near hind. Grounded paws travel backward relative to the stationary torso; recovery paws bend, lift and travel forward. Opposite front legs and opposite hind legs are each four frames apart; front/hind contacts are staggered by two frames.

Visual review checks all four attached legs, both rear paws' forward/back travel and lift, and the frame 8→1 transition. The torso and heads stay steady; all three attached tails now wag through a wider arc without hiding the paws. At 160 ms per frame, the loop lasts 1.28 s. Use 0.5× speed and the frame slider in the [gallery](../index.html) to inspect the leg phases and tail sweep.

`node scripts/animations.mjs --check` verifies export dimensions, distinct frames, transparent margins, timing, loop metadata and the saved manifest. Those checks do not judge anatomy or gait; the stride requires visual inspection.

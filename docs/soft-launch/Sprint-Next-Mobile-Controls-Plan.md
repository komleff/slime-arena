# Sprint Plan: Mobile Joystick Responsiveness and Flight Assist Tuning

## Context
Mobile joystick control feels inert and oscillatory during turns. PC mouse control feels responsive.
Goal is to improve responsiveness on touch devices without breaking physics, architecture, or server authority.

## Constraints
- Client continues to send only `InputCommand` (moveX, moveY, ability).
- Server remains authoritative for physics and movement.
- Changes should be isolated to balance config and minimal input/assist logic.
- No architectural rewrites or new network contracts.

## References
- `client/src/input/joystick.ts`
- `client/src/main.ts`
- `server/src/rooms/systems/movementSystems.ts`
- `shared/src/config.ts`
- `config/balance.json`
- `.memory_bank/ui_extension/components/virtual_joystick.md`
- `.memory_bank/modules/U2-smoothing.md`

## Step-by-step plan

| Step | Expected result | Files/modules touched | Risks/uncertainties |
| --- | --- | --- | --- |
| 1. Baseline measurements on priority devices | Comparable before/after metrics for turn time, lateral drift, and oscillation | None (use existing debugJoystick logging) | Device FPS and OS touch behavior can skew results |
| 2. Tune joystick input parameters | Faster response to touch with less deadzone lag | `config/balance.json` (controls), `shared/src/config.ts` (validation only if new fields needed) | Too aggressive sensitivity can cause twitchy feel |
| 3. Tune yaw (angular) Flight Assist parameters | Faster heading alignment with less overshoot | `config/balance.json` (assist), `shared/src/config.ts` | Risk of making PC control too sharp |
| 4. Tune lateral drift damping | Reduced side-slip during turn transitions | `config/balance.json` (assist), `server/src/rooms/systems/movementSystems.ts` (no logic changes expected) | Over-damping can feel "sticky" |
| 5. Optional: add touch-only response curve for joystick | More precise micro-control without sacrificing max turn rate | `client/src/input/joystick.ts`, `client/src/main.ts`, `shared/src/config.ts`, `config/balance.json` | Must avoid changing mouse behavior |
| 6. Optional: refine predictive yaw braking edge cases | Reduce oscillation on fast direction changes | `server/src/rooms/systems/movementSystems.ts`, `shared/src/config.ts`, `config/balance.json` | Server change affects all devices; needs careful tuning |
| 7. Validate on device matrix | Confirm improvement on Telegram mobile + tablet without regressions on PC | Test checklist only | Limited device coverage may miss edge cases |

## Parameter candidates (initial ranges)

| Parameter | Current (balance.json) | Suggested range | Notes |
| --- | --- | --- | --- |
| controls.joystickDeadzone | 0.10 | 0.05 - 0.08 | Reduce idle gap for faster response |
| controls.joystickSensitivity | 1.0 | 1.1 - 1.3 | Increase response without changing max range |
| controls.joystickFollowSpeed | 0.8 | 0.9 - 1.0 | Reduce "lag" of adaptive base |
| assist.yawRateGain | 4.0 | 4.5 - 6.0 | Faster turn command scaling |
| assist.reactionTimeS | 0.15 | 0.10 - 0.12 | Shorter time to reach target angVel |
| assist.angularStopTimeS | 0.20 | 0.12 - 0.18 | Faster stop to avoid overshoot |
| assist.angularBrakeBoostFactor | 1.5 | 1.6 - 2.0 | Stronger braking when input stops |
| assist.angularDeadzoneRad | 0.02 | 0.01 - 0.015 | Start turning earlier on small input |
| assist.counterAccelTimeS | 0.15 | 0.10 - 0.12 | Faster lateral drift cancellation |
| assist.counterAccelDirectionThresholdDeg | 30 | 20 - 25 | Trigger counter-accel earlier |
| assist.overspeedDampingRate | 0.2 | 0.25 - 0.35 | Faster damping near speed limits |
| assist.velocityErrorThreshold | 0.1 | 0.05 - 0.08 | React to smaller velocity error |
| worldPhysics.angularDragK | 1.0 | 1.0 - 1.4 | Global angular damping; apply with care |

## Test scenarios (acceptance checks)
- 90-degree and 180-degree turns at medium and high speed: time to align heading should decrease, overshoot should reduce.
- Zig-zag and figure-eight paths: oscillation should reduce without "stuck" feeling.
- Small corrections near target: micro-control should feel consistent, not jittery.
- PC mouse regression check: turn response should remain stable and not overshoot more than baseline.

## Success criteria
- Noticeably quicker alignment to input direction on touch devices.
- Reduced lateral drift during turn transitions.
- No significant regressions for mouse/keyboard control.

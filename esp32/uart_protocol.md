## ESP32-CAM To Controller UART Protocol

This protocol connects `ArtificialVision/ArtificialVision.ino` on the `ESP32-CAM AI Thinker`
to `esp32/vision_controller/vision_controller.ino` on the controller `ESP32`.

### Wiring

- Connect `GND` on both boards.
- Connect `ESP32-CAM TX` to the controller `ESP32 RX`.
- Use `115200` baud on both boards.

Default sketch pins:

- `ESP32-CAM TX`: `GPIO14`
- Controller `RX`: `GPIO32`

If those pins conflict with your board layout, change the constants in both sketches together.

### Message Format

The camera sends one newline-terminated ASCII message per accepted detection:

```text
DETECT:bottle
DETECT:can
```

Rules:

- Messages are uppercase command + lowercase item name.
- Each message ends with `\n`.
- The controller ignores any line that does not start with `DETECT:`.
- Only `bottle` and `can` are valid item types in version 1.

### Camera-Side Detection Rules

- The camera only emits a message after the same item is detected in multiple consecutive inferences.
- A cooldown window prevents one physical object from sending multiple UART messages.
- Confidence can be logged to the USB serial monitor, but it is not part of the UART protocol in version 1.

### Controller-Side Handling Rules

- Ignore detections when no QR session or keypad account number is active.
- Ignore detections while a previous item is still being processed.
- QR session flow: the controller polls `poll-session` with its flashed `MACHINE_CODE`, stores the returned `session_id` and account number, then includes both `session_id` and `machine_code` when calling Supabase `add-points`.
- Keypad fallback: the controller validates the typed account number with `validate-account` and calls `add-points` with the account number only.
- After accepting a detection, run one servo cycle and then call Supabase `add-points`.
- Clear the active controller account only after the points request succeeds. QR sessions remain in Supabase until they expire or are reused by the poll loop.

### Future-Compatible Extension

If you later want to include confidence, this format can be extended without breaking the prefix check:

```text
DETECT:bottle:0.91
DETECT:can:0.87
```

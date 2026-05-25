# EcoRewards - Recycling Rewards App

A React Native (Expo) mobile app that rewards users with points for recycling bottles and cans. An ESP32 device detects the items and sends points to the user's account via Supabase.

## Points System

- **Bottle recycled:** +15 points
- **Can recycled:** +10 points
- **Rewards start at:** 200 points

## Tech Stack

- **Frontend:** React Native + Expo (TypeScript), Expo Router
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, Edge Functions)
- **Hardware:** ESP32 microcontroller with item sensors

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in order:
   - `supabase/migrations/001_create_tables.sql` - Creates tables, RLS, and triggers
   - `supabase/migrations/002_seed_rewards.sql` - Seeds reward options
   - `supabase/migrations/003_add_account_numbers.sql` - Adds unique numeric account numbers for keypad login on the machine
3. Enable the Email auth provider in Supabase Dashboard > Authentication > Providers
4. Copy your project URL and anon key

### 3. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Fill in your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the App

```bash
npx expo start
```

### 5. Deploy Edge Function

```bash
supabase functions deploy add-points
supabase functions deploy validate-account
```

### 6. ESP32 Setup

The project now supports a two-board hardware flow:

- `ArtificialVision/ArtificialVision.ino`: ESP32-CAM AI Thinker running the vision model.
- `esp32/vision_controller/vision_controller.ino`: controller ESP32 handling keypad entry, LCD status, servo actuation, and Supabase calls.
- `esp32/uart_protocol.md`: UART wiring and message contract between both boards.

Update the WiFi credentials, Supabase URL, and service role key in the controller sketch before flashing.

Arduino libraries used by the controller sketch:

- `Keypad`
- `ESP32Servo`
- `LiquidCrystal_I2C`

Machine flow:

1. User opens the app and checks their account number.
2. User types the account number on the controller ESP32 keypad.
3. The controller validates the account with `validate-account`.
4. The ESP32-CAM detects `bottle` or `can` and sends `DETECT:bottle` or `DETECT:can` over UART.
5. The controller LCD shows status updates during typing, validation, recognition, and points upload.
6. The controller moves the servo and credits points through `add-points`.
7. The app receives the updated balance through Supabase Realtime.

### 7. Hardware Notes

- Share `GND` between the ESP32-CAM and the controller ESP32.
- Connect the ESP32-CAM UART `TX` pin to the controller ESP32 UART `RX` pin.
- Connect the LCD `SDA` to controller `GPIO21` and `SCL` to controller `GPIO22`.
- Connect the LCD `GND` to controller `GND` and `VCC` to the backpack-supported supply.
- Version 1 reuses the existing Supabase Edge Functions without backend changes.
- If you later need retry-safe deduplication, extend `add-points` with a `device_id` and `event_id`.

### 8. LCD Status Flow

The `I2C LCD 1602` on the controller ESP32 shows short status messages such as:

- `Enter account` / `Press # to send`
- `Account:` / typed digits
- `Account valid` / `Insert item`
- `Waiting item...` / active account number
- `Detected:` / `Bottle` or `Can`
- `Sorting item` / `Please wait`
- `Bottle +15 pts` or `Can +10 pts`
- `Points failed` / `Retry item`

## Project Structure

```
app/
  (auth)/           - Login, Register, Profile Setup screens
  (tabs)/           - Home, Rewards Store, History, Profile tabs
components/         - Reusable UI components
lib/                - Supabase client, auth helpers, types
constants/          - Theme colors, spacing, typography
supabase/
  migrations/       - SQL schema and seed data
  functions/        - Edge Functions (add-points, validate-account)
esp32/              - Arduino sketch for ESP32
```

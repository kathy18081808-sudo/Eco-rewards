/*
 * ESP32 Vision Controller - EcoRewards recycling machine controller
 *
 * Flow:
 * 1. User enters a 6-digit account number on the keypad.
 * 2. The controller validates the account against Supabase.
 * 3. The ESP32-CAM sends `DETECT:bottle` or `DETECT:can` over UART.
 * 4. The controller runs the servo cycle once per accepted item.
 * 5. The controller credits reward points through the existing add-points function.
 *
 * Install libraries:
 * - Keypad by Mark Stanley / Alexander Brevig
 * - ESP32Servo by Kevin Harrington / John K. Bennett
 *
 * Replace WIFI_SSID, WIFI_PASSWORD, SUPABASE_URL, and SUPABASE_SERVICE_KEY
 * with your actual values before flashing.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Keypad.h>
#include <ESP32Servo.h>
#include <HardwareSerial.h>
#include <Wire.h>
#include "LiquidCrystal_I2C.h"

const char* WIFI_SSID = "iPhone de Leo";
const char* WIFI_PASSWORD = "flecha85espacial";
const char* SUPABASE_URL = "https://mjxubsqmqshnweocclyi.supabase.co";
const char* SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qeHVic3FtcXNobndlb2NjbHlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY5MDczMiwiZXhwIjoyMDkxMjY2NzMyfQ.2mlv13cG1Y9y8olD9mw-rdruMFQ0BaRDUXZ36sCwl5E";

const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

byte rowPins[ROWS] = {19, 18, 17, 16};
byte colPins[COLS] = {27, 26, 25, 33};

const int ACCOUNT_NUMBER_LENGTH = 6;
const unsigned long ACTIVE_ACCOUNT_TIMEOUT_MS = 60000;

const int VISION_UART_BAUD_RATE = 115200;
const int VISION_RX_PIN = 32;

const int SERVO_PIN = 13;
const int SERVO_CLOSED_ANGLE = 10;
const int SERVO_OPEN_ANGLE = 95;
const unsigned long SERVO_SETTLE_MS = 500;
const unsigned long SERVO_OPEN_HOLD_MS = 1200;

const uint8_t LCD_ADDRESS = 0x27;
const int LCD_COLUMNS = 16;
const int LCD_ROWS = 2;
const int LCD_SDA_PIN = 21;
const int LCD_SCL_PIN = 22;
const unsigned long STATUS_MESSAGE_DELAY_MS = 1200;

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
HardwareSerial visionSerial(2);
Servo sortingServo;
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLUMNS, LCD_ROWS);

String enteredAccountNumber = "";
String activeAccountNumber = "";
String uartBuffer = "";
unsigned long activeAccountSetAt = 0;
bool isProcessingItem = false;

void connectToWiFi();
void clearActiveAccount(const String& reason);
bool validateAccountNumber(const String& accountNumber);
bool sendPoints(const String& accountNumber, const String& itemType);
void handleKeypadInput();
void handleActiveAccountTimeout();
void handleVisionMessages();
void handleVisionLine(const String& line);
bool processDetectedItem(const String& itemType);
void runServoCycle();
bool isSupportedItemType(const String& itemType);
String formatLine(const String& text);
void showStatus(const String& line1, const String& line2);
void showIdlePrompt();
void showAccountEntry(const String& accountDigits);
void showWaitingForItem();
void showRecognition(const String& itemType);
void showPointsResult(const String& itemType, bool success);

void setup() {
  Serial.begin(115200);
  visionSerial.begin(VISION_UART_BAUD_RATE, SERIAL_8N1, VISION_RX_PIN, -1);

  sortingServo.setPeriodHertz(50);
  sortingServo.attach(SERVO_PIN, 500, 2400);
  sortingServo.write(SERVO_CLOSED_ANGLE);

  Wire.begin(LCD_SDA_PIN, LCD_SCL_PIN);
  lcd.init();
  lcd.backlight();
  showStatus("EcoRewards", "Booting...");

  Serial.println("EcoRewards vision controller booting...");
  Serial.println("Waiting for keypad account number. Press # to confirm, * to clear.");
  Serial.println("UART RX ready on GPIO32.");

  connectToWiFi();
  showIdlePrompt();
}

void loop() {
  handleKeypadInput();
  handleActiveAccountTimeout();
  handleVisionMessages();
  delay(20);
}

void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  showStatus("Connecting WiFi", "Please wait");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected to WiFi.");
  showStatus("WiFi connected", "Ready");
  delay(STATUS_MESSAGE_DELAY_MS);
}

void clearActiveAccount(const String& reason) {
  activeAccountNumber = "";
  activeAccountSetAt = 0;
  isProcessingItem = false;
  Serial.println("Account cleared: " + reason);
  showIdlePrompt();
}

bool validateAccountNumber(const String& accountNumber) {
  connectToWiFi();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected.");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/functions/v1/validate-account";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_SERVICE_KEY);

  String body = "{\"account_number\":\"" + accountNumber + "\"}";
  int httpCode = http.POST(body);
  String response = http.getString();
  http.end();

  if (httpCode == 200) {
    activeAccountNumber = accountNumber;
    activeAccountSetAt = millis();
    Serial.println("Account validated: " + accountNumber);
    Serial.println(response);
    showStatus("Account valid", "Insert item");
    delay(STATUS_MESSAGE_DELAY_MS);
    showWaitingForItem();
    return true;
  }

  Serial.println("Invalid account number. HTTP code: " + String(httpCode));
  Serial.println(response);
  showStatus("Invalid account", "Try again");
  delay(STATUS_MESSAGE_DELAY_MS);
  showIdlePrompt();
  return false;
}

bool sendPoints(const String& accountNumber, const String& itemType) {
  connectToWiFi();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected.");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/functions/v1/add-points";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_SERVICE_KEY);

  String body = "{\"account_number\":\"" + accountNumber + "\",\"item_type\":\"" + itemType + "\"}";
  int httpCode = http.POST(body);
  String response = http.getString();
  http.end();

  if (httpCode == 200) {
    Serial.println("Points sent successfully: " + response);
    return true;
  }

  Serial.println("Error sending points. HTTP code: " + String(httpCode));
  Serial.println(response);
  return false;
}

void handleKeypadInput() {
  char key = keypad.getKey();
  if (!key) {
    return;
  }

  if (key >= '0' && key <= '9') {
    if (enteredAccountNumber.length() < ACCOUNT_NUMBER_LENGTH) {
      enteredAccountNumber += key;
      Serial.println("Entered: " + enteredAccountNumber);
      showAccountEntry(enteredAccountNumber);
    }
    return;
  }

  if (key == '*') {
    enteredAccountNumber = "";
    clearActiveAccount("manual clear");
    Serial.println("Entry cleared.");
    showStatus("Session cleared", "Enter account");
    delay(STATUS_MESSAGE_DELAY_MS);
    showIdlePrompt();
    return;
  }

  if (key == '#') {
    if (enteredAccountNumber.length() != ACCOUNT_NUMBER_LENGTH) {
      Serial.println("Please enter a 6-digit account number.");
      showStatus("Need 6 digits", "Press # again");
      delay(STATUS_MESSAGE_DELAY_MS);
      showAccountEntry(enteredAccountNumber);
      return;
    }

    showStatus("Validating...", enteredAccountNumber);
    if (validateAccountNumber(enteredAccountNumber)) {
      Serial.println("Controller armed and waiting for vision detection.");
    }

    enteredAccountNumber = "";
  }
}

void handleActiveAccountTimeout() {
  if (activeAccountNumber.length() > 0 && millis() - activeAccountSetAt > ACTIVE_ACCOUNT_TIMEOUT_MS) {
    showStatus("Session cleared", "Timeout");
    delay(STATUS_MESSAGE_DELAY_MS);
    clearActiveAccount("timeout");
  }
}

void handleVisionMessages() {
  while (visionSerial.available() > 0) {
    char incoming = static_cast<char>(visionSerial.read());

    if (incoming == '\r') {
      continue;
    }

    if (incoming == '\n') {
      if (uartBuffer.length() > 0) {
        handleVisionLine(uartBuffer);
        uartBuffer = "";
      }
      continue;
    }

    uartBuffer += incoming;

    if (uartBuffer.length() > 64) {
      Serial.println("UART buffer overflow, clearing partial message.");
      uartBuffer = "";
    }
  }
}

void handleVisionLine(const String& line) {
  Serial.println("UART received: " + line);

  if (!line.startsWith("DETECT:")) {
    Serial.println("Ignoring unknown UART message.");
    showStatus("UART ignored", "Unknown msg");
    delay(STATUS_MESSAGE_DELAY_MS);
    if (activeAccountNumber.length() > 0) {
      showWaitingForItem();
    } else {
      showIdlePrompt();
    }
    return;
  }

  String itemType = line.substring(7);
  itemType.trim();

  if (!isSupportedItemType(itemType)) {
    Serial.println("Ignoring unsupported item type: " + itemType);
    showStatus("Unknown item", itemType);
    delay(STATUS_MESSAGE_DELAY_MS);
    showWaitingForItem();
    return;
  }

  if (activeAccountNumber.length() == 0) {
    Serial.println("Detection ignored because no validated account is active.");
    showStatus("No account", "Enter number");
    delay(STATUS_MESSAGE_DELAY_MS);
    showIdlePrompt();
    return;
  }

  if (isProcessingItem) {
    Serial.println("Detection ignored because another item is already being processed.");
    showStatus("Busy", "Please wait");
    delay(STATUS_MESSAGE_DELAY_MS);
    showWaitingForItem();
    return;
  }

  isProcessingItem = true;
  showRecognition(itemType);
  delay(STATUS_MESSAGE_DELAY_MS);

  if (!processDetectedItem(itemType)) {
    isProcessingItem = false;
    showWaitingForItem();
  }
}

bool processDetectedItem(const String& itemType) {
  Serial.println("Accepted detection for: " + itemType);
  runServoCycle();
  Serial.println("Servo cycle complete, sending points...");

  if (sendPoints(activeAccountNumber, itemType)) {
    showPointsResult(itemType, true);
    delay(STATUS_MESSAGE_DELAY_MS);
    clearActiveAccount("points added for " + itemType);
    return true;
  }

  Serial.println("Points request failed, keeping the active account for retry.");
  showPointsResult(itemType, false);
  delay(STATUS_MESSAGE_DELAY_MS);
  return false;
}

void runServoCycle() {
  showStatus("Sorting item", "Please wait");
  Serial.println("Opening servo gate.");
  sortingServo.write(SERVO_OPEN_ANGLE);
  delay(SERVO_SETTLE_MS);
  delay(SERVO_OPEN_HOLD_MS);

  Serial.println("Closing servo gate.");
  sortingServo.write(SERVO_CLOSED_ANGLE);
  delay(SERVO_SETTLE_MS);
}

bool isSupportedItemType(const String& itemType) {
  return itemType == "bottle" || itemType == "can";
}

String formatLine(const String& text) {
  String line = text;

  if (line.length() > LCD_COLUMNS) {
    line = line.substring(0, LCD_COLUMNS);
  }

  while (line.length() < LCD_COLUMNS) {
    line += " ";
  }

  return line;
}

void showStatus(const String& line1, const String& line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(formatLine(line1));
  lcd.setCursor(0, 1);
  lcd.print(formatLine(line2));
}

void showIdlePrompt() {
  showStatus("Enter account", "Press # to send");
}

void showAccountEntry(const String& accountDigits) {
  showStatus("Account:", accountDigits);
}

void showWaitingForItem() {
  String accountSuffix = activeAccountNumber.length() > 0 ? activeAccountNumber : enteredAccountNumber;
  showStatus("Waiting item...", accountSuffix);
}

void showRecognition(const String& itemType) {
  String label = itemType == "bottle" ? "Bottle" : "Can";
  showStatus("Detected:", label);
}

void showPointsResult(const String& itemType, bool success) {
  if (!success) {
    showStatus("Points failed", "Retry item");
    return;
  }

  if (itemType == "bottle") {
    showStatus("Bottle +15 pts", "Success");
    return;
  }

  showStatus("Can +10 pts", "Success");
}

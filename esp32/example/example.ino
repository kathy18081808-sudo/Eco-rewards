/*
 * ESP32 Example - EcoRewards Recycling Machine with Keypad
 *
 * Flow:
 * 1. User opens the app and reads their account number.
 * 2. User types that number on the machine keypad.
 * 3. User presses # to validate the account against Supabase.
 * 4. User inserts a bottle or can.
 * 5. ESP32 sends points to the validated account number.
 *
 * Install library:
 * - Keypad by Mark Stanley / Alexander Brevig
 *
 * Replace WIFI_SSID, WIFI_PASSWORD, SUPABASE_URL, and SUPABASE_SERVICE_KEY
 * with your actual values.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Keypad.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_URL = "https://your-project.supabase.co";
const char* SUPABASE_SERVICE_KEY = "your-service-role-key";

const int BOTTLE_SENSOR_PIN = 4;
const int CAN_SENSOR_PIN = 5;

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

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

String enteredAccountNumber = "";
String activeAccountNumber = "";
unsigned long activeAccountSetAt = 0;

const int ACCOUNT_NUMBER_LENGTH = 6;
const unsigned long ACTIVE_ACCOUNT_TIMEOUT_MS = 60000;

void setup() {
  Serial.begin(115200);
  pinMode(BOTTLE_SENSOR_PIN, INPUT);
  pinMode(CAN_SENSOR_PIN, INPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.println("Type account number on keypad, press # to confirm, * to clear.");
}

void clearActiveAccount(const String& reason) {
  activeAccountNumber = "";
  activeAccountSetAt = 0;
  Serial.println("Account cleared: " + reason);
}

bool validateAccountNumber(const String& accountNumber) {
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

  if (httpCode == 200) {
    String response = http.getString();
    activeAccountNumber = accountNumber;
    activeAccountSetAt = millis();
    Serial.println("Account validated: " + accountNumber);
    Serial.println(response);
    http.end();
    return true;
  }

  Serial.println("Invalid account number. HTTP code: " + String(httpCode));
  Serial.println(http.getString());
  http.end();
  return false;
}

bool sendPoints(const String& accountNumber, const String& itemType) {
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

  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Points sent successfully: " + response);
    http.end();
    return true;
  }

  Serial.println("Error sending points. HTTP code: " + String(httpCode));
  Serial.println(http.getString());
  http.end();
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
    }
    return;
  }

  if (key == '*') {
    enteredAccountNumber = "";
    clearActiveAccount("manual clear");
    Serial.println("Entry cleared.");
    return;
  }

  if (key == '#') {
    if (enteredAccountNumber.length() != ACCOUNT_NUMBER_LENGTH) {
      Serial.println("Please enter a 6-digit account number.");
      return;
    }

    if (validateAccountNumber(enteredAccountNumber)) {
      Serial.println("Ready to receive bottles or cans.");
    }

    enteredAccountNumber = "";
  }
}

void handleActiveAccountTimeout() {
  if (activeAccountNumber.length() > 0 && millis() - activeAccountSetAt > ACTIVE_ACCOUNT_TIMEOUT_MS) {
    clearActiveAccount("timeout");
  }
}

void handleSensors() {
  if (activeAccountNumber.length() == 0) {
    return;
  }

  if (digitalRead(BOTTLE_SENSOR_PIN) == HIGH) {
    Serial.println("Bottle detected!");
    if (sendPoints(activeAccountNumber, "bottle")) {
      clearActiveAccount("points added for bottle");
    }
    delay(3000);
  }

  if (digitalRead(CAN_SENSOR_PIN) == HIGH) {
    Serial.println("Can detected!");
    if (sendPoints(activeAccountNumber, "can")) {
      clearActiveAccount("points added for can");
    }
    delay(3000);
  }
}

void loop() {
  handleKeypadInput();
  handleActiveAccountTimeout();
  handleSensors();
  delay(50);
}

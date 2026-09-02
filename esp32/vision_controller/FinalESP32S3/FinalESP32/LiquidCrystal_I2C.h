#pragma once

#include <Arduino.h>
#include <Wire.h>

class LiquidCrystal_I2C {
public:
  LiquidCrystal_I2C(uint8_t address, uint8_t columns, uint8_t rows)
      : _address(address),
        _columns(columns),
        _rows(rows),
        _backlightMask(0x08) {}

  void init() {
    delay(50);
    write4bits(0x03 << 4);
    delay(5);
    write4bits(0x03 << 4);
    delayMicroseconds(150);
    write4bits(0x03 << 4);
    write4bits(0x02 << 4);

    command(0x28);
    command(0x08);
    clear();
    command(0x06);
    command(0x0C);
  }

  void backlight() {
    _backlightMask = 0x08;
    expanderWrite(0);
  }

  void noBacklight() {
    _backlightMask = 0x00;
    expanderWrite(0);
  }

  void clear() {
    command(0x01);
    delay(2);
  }

  void setCursor(uint8_t column, uint8_t row) {
    static const uint8_t rowOffsets[] = {0x00, 0x40, 0x14, 0x54};
    if (row >= _rows) {
      row = _rows - 1;
    }
    command(0x80 | (column + rowOffsets[row]));
  }

  size_t print(const String &value) {
    size_t written = 0;
    for (size_t i = 0; i < value.length(); i++) {
      written += write(value[i]);
    }
    return written;
  }

  size_t print(const char *value) {
    size_t written = 0;
    while (*value) {
      written += write(*value++);
    }
    return written;
  }

  size_t write(uint8_t value) {
    send(value, 0x01);
    return 1;
  }

private:
  uint8_t _address;
  uint8_t _columns;
  uint8_t _rows;
  uint8_t _backlightMask;

  void command(uint8_t value) {
    send(value, 0x00);
  }

  void send(uint8_t value, uint8_t mode) {
    uint8_t highNibble = value & 0xF0;
    uint8_t lowNibble = (value << 4) & 0xF0;
    write4bits(highNibble | mode);
    write4bits(lowNibble | mode);
  }

  void write4bits(uint8_t value) {
    expanderWrite(value);
    pulseEnable(value);
  }

  void expanderWrite(uint8_t value) {
    Wire.beginTransmission(_address);
    Wire.write(value | _backlightMask);
    Wire.endTransmission();
  }

  void pulseEnable(uint8_t value) {
    expanderWrite(value | 0x04);
    delayMicroseconds(1);
    expanderWrite(value & ~0x04);
    delayMicroseconds(50);
  }
};

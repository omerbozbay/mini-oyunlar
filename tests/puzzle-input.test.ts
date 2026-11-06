import { it, expect } from "vitest";
import {
  turkishWord,
  validWord,
  validNumber,
} from "../src/games/puzzles/input";
it("Türkçe ve NFC girişlerini sunucu sözleşmesine göre normalleştirir", () => {
  expect(turkishWord(" incir ")).toBe("İNCİR");
  expect(turkishWord("ışık")).toBe("IŞIK");
  expect(turkishWord("ışığı")).toBe("IŞIĞI");
  expect(validWord("qwert", 5, 5)).toBe(false);
  expect(validWord("ÇİLEK", 5, 5)).toBe(true);
  expect(validWord("YORGAN", 6, 6)).toBe(true);
});
it("dört farklı rakamı ve sıfır olmayan ilk haneyi doğrular", () => {
  expect(validNumber(" 1234 ")).toBe(true);
  for (const v of ["0123", "1123", "123", "1a34", "12345"])
    expect(validNumber(v)).toBe(false);
});

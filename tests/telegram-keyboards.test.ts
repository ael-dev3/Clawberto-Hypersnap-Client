import assert from "node:assert/strict";
import test from "node:test";

import {
  castCallbackData,
  castKeyboard,
  inferCastKeyboardState,
  parseCastCallback,
} from "../src/skills/telegram/keyboards";

const FID = 123;
const HASH_HEX = `0x${"ab".repeat(20)}`;
const SHORT_HASH = "ab".repeat(20);

function callbackDataFromKeyboard(keyboard: ReturnType<typeof castKeyboard>): string[] {
  return keyboard.inline_keyboard
    .flat()
    .map((button) => button.callback_data)
    .filter((value): value is string => typeof value === "string");
}

test("castKeyboard preserves liked and recasted state together", () => {
  const keyboard = castKeyboard(FID, HASH_HEX, {
    liked: true,
    recasted: true,
  });
  const callbackData = callbackDataFromKeyboard(keyboard);

  assert.deepEqual(
    callbackData.slice(0, 2),
    [
      castCallbackData("unlike", FID, HASH_HEX),
      castCallbackData("unrecast", FID, HASH_HEX),
    ]
  );
  assert.deepEqual(inferCastKeyboardState(keyboard), {
    liked: true,
    recasted: true,
  });
});

test("inferCastKeyboardState defaults to false when buttons are neutral", () => {
  const keyboard = castKeyboard(FID, HASH_HEX);

  assert.deepEqual(inferCastKeyboardState(keyboard), {
    liked: false,
    recasted: false,
  });
});

test("parseCastCallback rejects malformed callback data", () => {
  assert.equal(parseCastCallback("bogus"), null);
  assert.equal(parseCastCallback(`unknown:${FID}:${SHORT_HASH}`), null);
  assert.equal(parseCastCallback(`like:not-a-number:${SHORT_HASH}`), null);
  assert.equal(parseCastCallback(`like:${FID}abc:${SHORT_HASH}`), null);
  assert.equal(parseCastCallback(`like:0:${SHORT_HASH}`), null);
  assert.equal(parseCastCallback(`like:01:${SHORT_HASH}`), null);
  assert.equal(parseCastCallback(`like:${FID}:short`), null);
});

test("castCallbackData rejects malformed builder inputs", () => {
  assert.throws(
    () => castCallbackData("like", 0, HASH_HEX),
    /Callback FID must be a positive integer/
  );
  assert.throws(
    () => castCallbackData("like", FID, "0xabc"),
    /Callback hash must be a 20-byte hex string/
  );
  assert.throws(
    () => castCallbackData("like", FID, `${SHORT_HASH}ff`),
    /Callback hash must be a 20-byte hex string/
  );
});

test("parseCastCallback normalizes valid callback data", () => {
  assert.deepEqual(
    parseCastCallback(`recast:${FID}:${SHORT_HASH.toUpperCase()}`),
    {
      action: "recast",
      fid: FID,
      hashHex: HASH_HEX,
    }
  );
});

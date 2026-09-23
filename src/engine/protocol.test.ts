import { describe, expect, it } from "vitest";
import { describeError, nextRequestId } from "./protocol";

describe("nextRequestId", () => {
  it("never repeats, so a late reply cannot be matched to a new request", () => {
    const ids = [nextRequestId(), nextRequestId(), nextRequestId()];
    expect(new Set(ids).size).toBe(3);
  });
  it("increases", () => {
    const first = nextRequestId();
    expect(nextRequestId()).toBeGreaterThan(first);
  });
});

describe("describeError", () => {
  it("uses an Error's message", () => {
    expect(describeError(new Error("out of memory"))).toBe("out of memory");
  });
  it("stringifies anything else, because a worker can reject with a non-Error", () => {
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError(undefined)).toBe("undefined");
  });
  it("never returns an empty message, so the UI always has something to show", () => {
    expect(describeError(new Error(""))).toBe("The model failed without a message.");
  });
});

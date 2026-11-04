import { validateTaskBody } from "../utils/validation";

describe("task date validation", () => {
  it.each(["not-a-date", 123, {}, []])("rejects invalid deadline %p", (deadline) => {
    expect(() => validateTaskBody({ title: "Task", deadline }, "create")).toThrow(
      "deadline must be a valid date"
    );
  });

  it.each(["not-a-date", 123, {}])("rejects invalid scheduledAt %p", (scheduledAt) => {
    expect(() => validateTaskBody({ title: "Task", scheduledAt }, "create")).toThrow(
      "scheduledAt must be a valid date"
    );
  });

  it("allows explicit missing dates and normalizes them to null", () => {
    expect(validateTaskBody({ title: "Task", deadline: null, scheduledAt: "" }, "create"))
      .toMatchObject({ deadline: null, scheduledAt: null });
  });

  it("accepts valid ISO dates", () => {
    const fields = validateTaskBody(
      { title: "Task", deadline: "2026-12-01T10:00:00.000Z" },
      "create"
    );
    expect(fields.deadline?.toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });
});

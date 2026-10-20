import { describe, expect, it } from "vitest";
import { MISSION_STATUSES, TASK_STATUSES, assertMissionTransition, assertTaskTransition, canTransitionMission, canTransitionTask, isTerminalTask, InvalidTransitionError } from "@/lib/domain/states";

describe("state machines", () => {
  it("terminal states have no outgoing transitions", () => {
    for (const s of ["completed", "failed", "cancelled"] as const) for (const to of MISSION_STATUSES) expect(canTransitionMission(s, to)).toBe(false);
    for (const s of TASK_STATUSES.filter(isTerminalTask)) for (const to of TASK_STATUSES) expect(canTransitionTask(s, to)).toBe(false);
  });

  it("rejects skipping straight from draft to running", () => {
    expect(() => assertMissionTransition("draft", "running")).toThrow(InvalidTransitionError);
  });

  it("does not let a task jump from pending to succeeded", () => {
    expect(() => assertTaskTransition("pending", "succeeded")).toThrow(InvalidTransitionError);
    expect(() => assertTaskTransition("awaiting_approval", "running")).toThrow(InvalidTransitionError);
  });

  it("allows the happy path", () => {
    expect(() => {
      assertMissionTransition("draft", "planning");
      assertMissionTransition("planning", "awaiting_approval");
      assertMissionTransition("awaiting_approval", "queued");
      assertMissionTransition("queued", "running");
      assertMissionTransition("running", "completed");
      assertTaskTransition("pending", "ready");
      assertTaskTransition("ready", "running");
      assertTaskTransition("running", "succeeded");
    }).not.toThrow();
  });
});

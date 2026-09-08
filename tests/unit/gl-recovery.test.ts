import { beforeEach, describe, expect, it, vi } from "vitest";
import * as audit from "@/lib/repositories/audit.repository";
import * as sessions from "@/lib/repositories/session.repository";
import * as posting from "@/modules/accounting/services/gl-posting.service";
import { retryFailedGlPosting } from "@/modules/accounting/services/gl-repost.service";
import { listRecentGlPostingFailures } from "@/modules/accounting/services/gl-posting-failures.service";
import type {
  AuditLog,
  CashierSession,
  JournalEntryWithLines,
} from "@/lib/types";
vi.mock("@/lib/repositories/audit.repository");
vi.mock("@/lib/repositories/session.repository");
vi.mock("@/modules/accounting/services/gl-posting.service");
const failure = {
  id: "failure",
  org_id: "org",
  user_id: "actor",
  entity_type: "gl_journal",
  action: "gl.posting_failed",
  entity_id: "session",
  store_id: "store",
  created_at: "2026-09-06T10:00:00Z",
  metadata: {
    label: "postSessionVarianceJournal",
    source: "adjustment",
    error: "Not authenticated",
  },
} as AuditLog;
describe("GL recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(audit.getAuditLog).mockResolvedValue(failure);
    vi.mocked(sessions.getSession).mockResolvedValue({
      id: "session",
      store_id: "store",
      status: "closed",
      variance: 442.49,
      closed_at: "2026-09-06T10:00:00Z",
    } as CashierSession);
  });
  it("records recovery only after a successful posting, using the original closing date", async () => {
    vi.mocked(posting.postSessionVarianceJournal).mockResolvedValue({
      id: "journal",
    } as JournalEntryWithLines);
    await retryFailedGlPosting("failure", "actor");
    expect(posting.postSessionVarianceJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        entryDate: "2026-09-06T10:00:00Z",
        variance: 442.49,
      }),
    );
    expect(audit.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "gl.posting_recovered",
        metadata: expect.objectContaining({ failure_id: "failure" }),
      }),
    );
  });
  it.each(["skipped", "auth failure"])(
    "does not clear a %s posting",
    async (kind) => {
      if (kind === "skipped")
        vi.mocked(posting.postSessionVarianceJournal).mockResolvedValue(null);
      else
        vi.mocked(posting.postSessionVarianceJournal).mockRejectedValue(
          new Error("Not authenticated"),
        );
      await expect(retryFailedGlPosting("failure", "actor")).rejects.toThrow();
      expect(audit.insertAuditLog).not.toHaveBeenCalled();
    },
  );
  it("uses unresolved pagination rather than the historical audit list", async () => {
    vi.mocked(audit.listUnresolvedGlFailures).mockResolvedValue([failure]);
    expect((await listRecentGlPostingFailures()).failures[0]).toMatchObject({
      id: "failure",
      error: "Not authenticated",
    });
    expect(audit.listAuditLogs).not.toHaveBeenCalled();
  });
});

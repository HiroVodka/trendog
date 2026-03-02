import { afterEach, describe, expect, it, vi } from "vitest";
import { SlackWebhookNotifier } from "../../../src/adapters/notifier/slackWebhookNotifier.js";

describe("SlackWebhookNotifier", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts markdown to webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const notifier = new SlackWebhookNotifier("https://hooks.slack.com/services/test");
    const result = await notifier.notify("hello");

    expect(result).toEqual({ ok: true, status: 200, body: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when webhook URL is missing", async () => {
    const notifier = new SlackWebhookNotifier("");
    await expect(notifier.notify("hello")).rejects.toThrow("SLACK_WEBHOOK_URL is missing");
  });
});

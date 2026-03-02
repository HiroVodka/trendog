import { Notifier } from "../../ports/notifier.js";

export class SlackWebhookNotifier implements Notifier {
  constructor(private readonly webhookUrl: string) {}

  async notify(markdown: string): Promise<{ ok: boolean; status: number; body: string }> {
    if (!this.webhookUrl) {
      throw new Error("SLACK_WEBHOOK_URL is missing");
    }

    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: markdown
      })
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  }
}

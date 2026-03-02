import { runApp } from "../../app.js";

export interface Env {
  GEMINI_API_KEY: string;
  SLACK_WEBHOOK_URL: string;
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await runApp({
      mode: "normal",
      dryRun: false,
      maxTopics: 17,
      debug: false,
      runId: `workers-${Date.now()}`,
      geminiApiKey: env.GEMINI_API_KEY,
      slackWebhookUrl: env.SLACK_WEBHOOK_URL
    });
  }
};

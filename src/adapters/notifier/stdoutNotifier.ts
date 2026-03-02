import { Notifier } from "../../ports/notifier.js";

export class StdoutNotifier implements Notifier {
  async notify(markdown: string): Promise<{ ok: boolean; status: number; body: string }> {
    console.log(markdown);
    return { ok: true, status: 200, body: "ok" };
  }
}

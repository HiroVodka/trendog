export interface Notifier {
  notify(markdown: string): Promise<{ ok: boolean; status: number; body: string }>;
}

import type Echo from "laravel-echo";

export type ReverbEcho = Echo<"reverb">;

export async function createEcho(): Promise<ReverbEcho> {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) console.log("[Echo] dynamic import 시작...");

  const [{ default: EchoClass }, { default: Pusher }] = await Promise.all([
    import("laravel-echo"),
    import("pusher-js"),
  ]);
  if (isDev) console.log("[Echo] import 완료");

  window.Pusher = Pusher;

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const wsHost = process.env.NEXT_PUBLIC_REVERB_HOST;
  if (isDev) console.log("[Echo] 설정 — wsHost:", wsHost);

  try {
    const echo = new EchoClass({
      broadcaster: "reverb",
      key,
      wsHost,
      wsPort: 443,
      wssPort: 443,
      forceTLS: true,
      enabledTransports: ["ws", "wss"],
      disableStats: true,
    });
    if (isDev) console.log("[Echo] Echo 인스턴스 생성 완료");
    return echo;
  } catch (err) {
    console.error("[Echo] Echo 인스턴스 생성 실패:", err);
    throw err;
  }
}

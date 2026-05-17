import type Echo from "laravel-echo";

export type ReverbEcho = Echo<"reverb">;

export async function createEcho(): Promise<ReverbEcho> {
  console.log("[Echo] dynamic import 시작...");
  const [{ default: EchoClass }, { default: Pusher }] = await Promise.all([
    import("laravel-echo"),
    import("pusher-js"),
  ]);
  console.log("[Echo] import 완료, EchoClass:", !!EchoClass, "Pusher:", !!Pusher);

  window.Pusher = Pusher;

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const wsHost = process.env.NEXT_PUBLIC_REVERB_HOST;
  console.log("[Echo] 설정 — key:", key, "wsHost:", wsHost);

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
  console.log("[Echo] Echo 인스턴스 생성 완료");
  return echo;
}

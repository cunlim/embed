export {};

declare global {
  interface Window {
    Pusher: typeof import("pusher-js").default;
  }
}

export declare class Notification {
    name: Notification.Name;
    userInfo: {};
    constructor(message: {});
}
export declare module Notification {
    enum Name {
        PlaybackQueueChanged = "PlaybackQueueChanged",
    }
}

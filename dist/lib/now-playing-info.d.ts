export declare class NowPlayingInfo {
    duration: number;
    elapsedTime: number;
    title: string;
    artist: string;
    album: string;
    appDisplayName: string;
    appBundleIdentifier: string;
    playbackState: NowPlayingInfo.State;
    timestamp: number;
    constructor(message: {});
}
export declare module NowPlayingInfo {
    enum State {
        Playing = "playing",
        Paused = "paused",
    }
}

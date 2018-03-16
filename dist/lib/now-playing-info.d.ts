export declare class NowPlayingInfo {
    message: any;
    duration: number;
    elapsedTime: number;
    title: string;
    artist: string;
    album: string;
    appDisplayName: string;
    appBundleIdentifier: string;
    playbackState: NowPlayingInfo.State;
    timestamp: number;
    constructor(message: any);
    percentCompleted(): number;
    toString(): string;
}
export declare module NowPlayingInfo {
    enum State {
        Playing = "playing",
        Paused = "paused",
    }
}

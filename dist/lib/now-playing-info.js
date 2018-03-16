"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NowPlayingInfo {
    constructor(message) {
        this.message = message;
        let nowPlayingInfo = message.nowPlayingInfo;
        if (nowPlayingInfo) {
            this.duration = nowPlayingInfo.duration;
            this.elapsedTime = nowPlayingInfo.elapsedTime;
            this.title = nowPlayingInfo.title;
            this.artist = nowPlayingInfo.artist;
            this.album = nowPlayingInfo.album;
            this.timestamp = nowPlayingInfo.timestamp;
        }
        this.appDisplayName = message.displayName;
        this.appBundleIdentifier = message.displayID;
        if (message.playbackState == 2) {
            this.playbackState = NowPlayingInfo.State.Paused;
        }
        else if (message.playbackState == 1) {
            this.playbackState = NowPlayingInfo.State.Playing;
        }
    }
    percentCompleted() {
        if (!this.elapsedTime || !this.duration) {
            return 0;
        }
        return Math.floor((this.elapsedTime / this.duration) * 100);
    }
    toString() {
        if (this.artist) {
            return this.title + " by " + this.artist + " (" + this.percentCompleted() + ") | "
                + this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
                + this.playbackState;
        }
        else if (this.title) {
            return this.title + " (" + this.percentCompleted() + ") | "
                + this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
                + this.playbackState;
        }
        else {
            return this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
                + this.playbackState;
        }
    }
}
exports.NowPlayingInfo = NowPlayingInfo;
(function (NowPlayingInfo) {
    let State;
    (function (State) {
        State["Playing"] = "playing";
        State["Paused"] = "paused";
    })(State = NowPlayingInfo.State || (NowPlayingInfo.State = {}));
})(NowPlayingInfo = exports.NowPlayingInfo || (exports.NowPlayingInfo = {}));

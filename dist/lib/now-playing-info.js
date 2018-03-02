"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NowPlayingInfo {
    constructor(message) {
        let nowPlayingInfo = message['nowPlayingInfo'];
        if (nowPlayingInfo) {
            this.duration = nowPlayingInfo['duration'];
            this.elapsedTime = nowPlayingInfo['elapsedTime'];
            this.title = nowPlayingInfo['title'];
            this.artist = nowPlayingInfo['artist'];
            this.album = nowPlayingInfo['album'];
            this.timestamp = nowPlayingInfo['timestamp'];
        }
        this.appDisplayName = message['displayName'];
        this.appBundleIdentifier = message['displayID'];
        if (message['playbackState'] == 2) {
            this.playbackState = NowPlayingInfo.State.Paused;
        }
        else {
            this.playbackState = NowPlayingInfo.State.Playing;
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

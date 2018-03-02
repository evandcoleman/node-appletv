

export class NowPlayingInfo {
  public duration: number;
  public elapsedTime: number;
  public title: string;
  public artist: string;
  public album: string;
  public appDisplayName: string;
  public appBundleIdentifier: string;
  public playbackState: NowPlayingInfo.State;
  public timestamp: number;

  constructor(message: {}) {
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
    } else {
      this.playbackState = NowPlayingInfo.State.Playing;
    }
  }
}

export module NowPlayingInfo {
  export enum State {
    Playing = 'playing',
    Paused = 'paused'
  }
}
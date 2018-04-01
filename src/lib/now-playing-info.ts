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

  constructor(public message: any) {
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
    } else if (message.playbackState == 1) {
      this.playbackState = NowPlayingInfo.State.Playing;
    }
  }

  public percentCompleted(): string {
    if (!this.elapsedTime || !this.duration) { return "0.00"; }

    return ((this.elapsedTime / this.duration) * 100).toPrecision(3);
  }

  public toString(): string {
    if (this.artist) {
      let album = this.album == null ? '' : " -- " + this.album + " ";
      return this.title + " by " + this.artist + album + " (" + this.percentCompleted() + "%) | "
        + this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
        + this.playbackState; 
    } else if (this.title) {
      return this.title + " (" + this.percentCompleted() + "%) | "
        + this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
        + this.playbackState; 
    } else {
      return this.appDisplayName + " (" + this.appBundleIdentifier + ") | "
        + this.playbackState; 
    }
  }
}

export module NowPlayingInfo {
  export enum State {
    Playing = 'playing',
    Paused = 'paused'
  }
}
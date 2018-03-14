

export class Message {
  public payload: any;

  constructor(public type: string, private message: any) {
    let key = "." + type.charAt(0).toLowerCase() + type.slice(1);
    this.payload = message[key];
  }

  toObject(): any {
    return this.message;
  }
}
export declare class Message {
    type: string;
    private message;
    payload: any;
    constructor(type: string, message: any);
    toObject(): any;
}

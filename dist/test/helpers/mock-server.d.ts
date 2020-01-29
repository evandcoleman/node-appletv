import { AppleTV } from '../../lib/appletv';
import { Message } from '../../lib/message';
export declare class MockServer {
    device: AppleTV;
    message: Promise<Message>;
    private server;
    constructor();
    close(): void;
}

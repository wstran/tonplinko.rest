import type { ServerWebSocket } from "bun";
import { config } from "../config";

const requestCounts = new Map<string, { count: number, timestamp: number }>();
const socketLimits = new Map<string, { count: number, timestamp: number }>();

export const rateLimitMiddleware = (req: Request) => {
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-clientIp') || req.headers.get('remote-address') || (Bun.env.NODE_ENV === 'development' && '127.0.0.1');

    if (!clientIp) return new Response("Bad request.", { status: 400 });

    const currentTime = Date.now();

    if (!requestCounts.has(clientIp)) {
        requestCounts.set(clientIp, { count: 1, timestamp: currentTime });
    } else {
        const requestInfo = requestCounts.get(clientIp)!;

        if (currentTime - requestInfo.timestamp < config.fetch_limiter[1]) {
            requestInfo.count += 1;

            if (requestInfo.count > config.fetch_limiter[0]) return new Response("Too many requests", { status: 429 });
        } else {
            requestCounts.set(clientIp, { count: 1, timestamp: currentTime });
        };
    };

    return null;
}

export const rateLimitWebSocket = (_: ServerWebSocket<unknown>, clientIp: string) => {
    const currentTime = Date.now();

    if (!socketLimits.has(clientIp)) {
        socketLimits.set(clientIp, { count: 1, timestamp: currentTime });
    } else {
        const socketInfo = socketLimits.get(clientIp)!;
        if (currentTime - socketInfo.timestamp < config.socket_limiter[1]) {
            socketInfo.count += 1;

            if (socketInfo.count > config.socket_limiter[0]) {
                return true;
            }
        } else {
            socketLimits.set(clientIp, { count: 1, timestamp: currentTime });
        };
    };

    return false;
}
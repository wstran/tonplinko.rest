import type { UserWithNonce } from "./user";

export interface WS_DATA { isAuthenticated?: boolean, accessToken?: string, user?: UserWithNonce, sharedKey?: Buffer, signature?: string, clientIp?: string };
import type { UserWithNonce } from "../../types";
import binData from "../../bins";
import { generateRandomInt } from "../../libs/custom";

export default async (_: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    if (
        typeof data.ball_price !== 'number' || data.ball_price < 0 ||
        typeof data.row !== 'number' || data.row < 8 || data.row > 16 ||
        data.risk_level !== 'LOW' && data.risk_level !== 'MEDIUM' && data.risk_level !== 'HIGH'
    ) return;

    const bin = generateRandomInt(0, 0);

    const ball_seed = binData[data.row][bin][generateRandomInt(0, binData[data.row][bin].length - 1)];

    replyMessage(data.return_action, { ball_seed, ball_id: generateRandomInt(0, 999999) });
}
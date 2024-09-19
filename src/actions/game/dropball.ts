import type { UserWithNonce } from "../../types";
import binData from "../../bins";
import { generateRandomInt } from "../../libs/custom";
import { useUser } from "../../hooks/useUser";
import Decimal from "decimal.js";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    if (
        typeof data.ball_price !== 'number' || !Number.isFinite(data.ball_price) || data.ball_price < 0 ||
        typeof data.row !== 'number' || data.row < 8 || data.row > 16 ||
        !['LOW', 'MEDIUM', 'HIGH'].includes(data.risk_level)
    ) return;

    try {
        const exists = await useUser(user.tele_id, async (hook) => {
            const tpl_balance = hook.getTPLBalance();

            if (tpl_balance <= data.ball_price) {
                replyMessage('receiver_message_data', { content: 'You do not have enough balance to drop the ball', type: 'error' });
                return;
            };

            const percent = generateRandomInt(0, 100);

            let bin = 8;

            if (data.risk_level === 'HIGH') {
                bin = percent > 1 ? generateRandomInt(5, 11) : generateRandomInt(1, 15);
            } else if (data.risk_level === 'MEDIUM') {
                bin = percent > 1 ? generateRandomInt(6, 9) : generateRandomInt(1, 15);
            } else if (data.risk_level === 'LOW') {
                bin = percent > 1 ? generateRandomInt(7, 10) : generateRandomInt(1, 15);
            };

            const now_date = new Date();

            const ball_seed = binData[data.row][bin][generateRandomInt(0, binData[data.row][bin].length - 1)];

            const ball_id = new Bun.MD5().update(`${user.tele_id}${now_date.getTime()}${bin}${ball_seed}${Math.random()}`).digest('hex');

            const bin_risk = await hook.getBinRisk(data.row, data.risk_level, bin);

            if (!bin_risk) return;

            let new_balance = new Decimal(tpl_balance).minus(data.ball_price).toNumber();

            new_balance = new Decimal(new_balance).plus(new Decimal(data.ball_price).times(bin_risk).toNumber()).toNumber();

            const seted = hook.setTPLBalance(new_balance, now_date);

            if (seted === false) return;

            replyMessage(data.return_action, { ball_seed, ball_id, ball_price: data.ball_price });
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
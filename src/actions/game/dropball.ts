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

            const { safe, risky } = config_rate_payouts[data.row][data.risk_level];

            const percent = generateRandomInt(0, 100);

            const bin = generateRandomInt(...(percent < 97 ? safe : risky));

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

const config_rate_payouts: {
    [row: number]: {
        [risk_level: string]: {
            safe: [number, number],
            risky: [number, number]
        }
    }
} = {
    [8]: {
        HIGHT: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
    [9]: {
        HIGHT: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
    [10]: {
        HIGHT: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
    [11]: {
        HIGHT: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
    [12]: {
        HIGHT: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
    [13]: {
        HIGHT: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
    [14]: {
        HIGHT: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
    [15]: {
        HIGH: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
    [16]: {
        HIGH: {
            safe: [5, 11],
            risky: [1, 15]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 15]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    },
};

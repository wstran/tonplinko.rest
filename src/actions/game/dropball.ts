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
    8: {
        HIGH: {
            safe: [2, 6],
            risky: [1, 7]
        },
        MEDIUM: {
            safe: [3, 5],
            risky: [1, 7]
        },
        LOW: {
            safe: [4, 6],
            risky: [1, 7]
        }
    },
    9: {
        HIGH: {
            safe: [3, 6],
            risky: [2, 7]
        },
        MEDIUM: {
            safe: [4, 7],
            risky: [1, 8]
        },
        LOW: {
            safe: [5, 8],
            risky: [1, 8]
        }
    },
    10: {
        HIGH: {
            safe: [4, 8],
            risky: [1, 9]
        },
        MEDIUM: {
            safe: [5, 8],
            risky: [1, 9]
        },
        LOW: {
            safe: [6, 9],
            risky: [2, 9]
        }
    },
    11: {
        HIGH: {
            safe: [5, 9],
            risky: [1, 10]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [1, 10]
        },
        LOW: {
            safe: [7, 10],
            risky: [2, 10]
        }
    },
    12: {
        HIGH: {
            safe: [6, 10],
            risky: [1, 11]
        },
        MEDIUM: {
            safe: [7, 10],
            risky: [1, 11]
        },
        LOW: {
            safe: [8, 11],
            risky: [2, 11]
        }
    },
    13: {
        HIGH: {
            safe: [7, 11],
            risky: [1, 12]
        },
        MEDIUM: {
            safe: [8, 11],
            risky: [1, 12]
        },
        LOW: {
            safe: [9, 12],
            risky: [2, 12]
        }
    },
    14: {
        HIGH: {
            safe: [8, 12],
            risky: [1, 13]
        },
        MEDIUM: {
            safe: [9, 12],
            risky: [1, 13]
        },
        LOW: {
            safe: [10, 13],
            risky: [2, 13]
        }
    },
    15: {
        HIGH: {
            safe: [7, 8],
            risky: [3, 12]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [2, 13]
        },
        LOW: {
            safe: [5, 10],
            risky: [1, 14]
        }
    },
    16: {
        HIGH: {
            safe: [5, 11],
            risky: [3, 13]
        },
        MEDIUM: {
            safe: [6, 9],
            risky: [2, 14]
        },
        LOW: {
            safe: [7, 10],
            risky: [1, 15]
        }
    }
};
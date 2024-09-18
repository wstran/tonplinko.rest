import type { UserWithNonce } from "../../types";
import { unSetUserFarmed, useUser, getFarmConfig, getUser, removeTPLBalance, setFarmLevel, addLog } from "../../hooks/useUser";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    try {
        const exists = await useUser(user.tele_id, async () => {
            const now_date = new Date();

            const unseted = await unSetUserFarmed(user.tele_id, now_date);

            if (unseted === false) return;

            const [farm_config, user_data] = await Promise.all([
                getFarmConfig(),
                getUser(user.tele_id),
            ]);

            if (farm_config === null || user_data === null) return;

            if (user_data.farm_level === 20) {
                replyMessage('receiver_message_data', { content: 'Your farm is already at the maximum level', type: 'error' });
                return;
            };

            const new_level = user_data.farm_level + 1;

            const upgarde_cost = farm_config[new_level.toString()].upgrade_cost;

            if (user_data.balances.tpl < upgarde_cost) {
                replyMessage('receiver_message_data', { content: 'You do not have enough balance to upgrade the farm', type: 'error' });
                return;
            };

            const removed = await removeTPLBalance(user.tele_id, upgarde_cost, now_date);

            const seted = await setFarmLevel(user.tele_id, new_level, now_date);

            if (removed === false || seted === false) return;

            await addLog(user.tele_id, {
                log_type: 'farm/upgrade',
                tele_id: user.tele_id,
                from_level: user_data.farm_level,
                to_level: new_level,
                tpl: upgarde_cost,
                created_at: now_date
            });

            replyMessage(data.return_action, { upgarde_cost, new_level });
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
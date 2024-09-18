import type { UserWithNonce } from "../../types";
import { useUser, getFarmConfig, getUser, addLog, addTPLBalance, setUserFarmed, getTPLFarmBalance } from "../../hooks/useUser";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    try {
        const exists = await useUser(user.tele_id, async () => {
            const [farm_config, user_data] = await Promise.all([
                getFarmConfig(),
                getUser(user.tele_id),
            ]);

            if (farm_config === null || user_data === null) return;

            if (!user_data.farm_at) {
                replyMessage('receiver_message_data', { content: 'You have not farmed yet', type: 'error' });
                return;
            };

            const now_date = new Date();

            const current_timestamp = now_date.getTime();

            const farm_timestamp = Date.parse(user_data.farm_at);

            if (current_timestamp - farm_timestamp < 2 * 60 * 60 * 1000) {
                replyMessage('receiver_message_data', { content: 'You can only claim every 2 hours', type: 'error' });
                return;
            };

            const farm_speed_per_hour = farm_config[user_data.farm_level.toString()].speed_per_hour;

            const total_farm_amount = ((current_timestamp - farm_timestamp) / (1000 * 60 * 60));

            const tpl_farm_balance = await getTPLFarmBalance(user.tele_id);

            const farm_amount_tpl = ((total_farm_amount > 2 ? 2 : total_farm_amount) * farm_speed_per_hour) + tpl_farm_balance;

            const added = await addTPLBalance(user.tele_id, farm_amount_tpl, now_date);

            const unseted = await setUserFarmed(user.tele_id, now_date);

            if (added === false || unseted === false) return;

            await addLog(user.tele_id, {
                log_type: 'farm/claim',
                tele_id: user.tele_id,
                amount: farm_amount_tpl,
                farm_at: user_data.farm_at,
                created_at: now_date
            });

            replyMessage(data.return_action, { farm_at: now_date, amount: farm_amount_tpl });
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
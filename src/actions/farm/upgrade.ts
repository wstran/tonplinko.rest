import type { UserWithNonce } from "../../types";
import { useUser } from "../../hooks/useUser";
import Decimal from "decimal.js";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    try {
        const exists = await useUser(user.tele_id, async (hook) => {
            const now_date = new Date();

            const unseted = hook.unSetUserFarmed(now_date);

            if (unseted === false) return;

            const [farm_config, user_data] = await Promise.all([
                hook.getFarmConfig(),
                hook.getUser(),
            ]);

            if (!farm_config || !user_data) return;

            if (user_data.farm_level === 20) {
                replyMessage('receiver_message_data', { content: 'Your farm is already at the maximum level', type: 'error' });
                return;
            };

            const new_level = user_data.farm_level + 1;
            
            const level_config = farm_config[new_level.toString()];

            const upgrade_type = level_config.upgrade_type;

            const upgarde_cost = level_config.upgrade_cost;
            
            if ((user_data.balances[upgrade_type] || 0) < upgarde_cost) {
                replyMessage('receiver_message_data', { content: 'You do not have enough balance to upgrade the farm', type: 'error' });
                return;
            };

            const current_timestamp = now_date.getTime();

            const farm_speed_per_hour = farm_config[user_data.farm_level.toString()].speed_per_hour;

            const farm_amount_tpl = new Decimal(new Decimal(current_timestamp)
                .minus(user_data.farm_at.getTime())
                .div(1000 * 60 * 60)
                .times(new Decimal(hook.getAllBoostPercent() || 0).div(100))
                .toNumber())
                .times(farm_speed_per_hour)
                .toNumber();

            const added = hook.addTPLFarmBalance(farm_amount_tpl, now_date);

            const removed = upgrade_type === 'tpl' ? hook.removeTPLBalance(upgarde_cost, now_date) : hook.removeTONBalance(upgarde_cost, now_date);

            const seted = hook.setFarmLevel(new_level, now_date);

            if (added === false || removed === false || seted === false) return;

            hook.addLog({
                log_type: 'farm/upgrade',
                tele_id: user.tele_id,
                from_level: user_data.farm_level,
                to_level: new_level,
                upgrade_type,
                upgarde_cost,
                created_at: now_date
            });

            replyMessage(data.return_action, { upgrade_type, upgarde_cost, new_level });
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
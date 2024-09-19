import type { UserWithNonce } from "../../types";
import { useUser } from "../../hooks/useUser";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    try {
        const exists = await useUser(user.tele_id, async (hook) => {
            const is_farmed = hook.isUserFarmed();

            if (is_farmed) {
                replyMessage('receiver_message_data', { content: 'You have already farmed', type: 'error' });
                return;
            };

            const now_date = new Date();

            const seted = hook.setUserFarmed(now_date);

            if (seted === false) return

            replyMessage(data.return_action, { farm_at: now_date });
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
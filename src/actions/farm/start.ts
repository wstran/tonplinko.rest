import type { UserWithNonce } from "../../types";
import { isUserFarmed, setUserFarmed, useUser } from "../../hooks/useUser";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    try {
        const exists = await useUser(user.tele_id, async () => {
            const is_farmed = await isUserFarmed(user.tele_id);

            if (is_farmed) {
                replyMessage('receiver_message_data', { content: 'You have already farmed', type: 'error' });
                return;
            };

            const now_date = new Date();

            const seted = await setUserFarmed(user.tele_id, now_date);

            if (seted === false) return

            replyMessage(data.return_action, { farm_at: now_date });
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
import type { UserWithNonce } from "../../types";
import { useUser } from "../../hooks/useUser";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    const { wallet } = data;

    try {
        const exists = await useUser(user.tele_id, async (user) => {
            
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
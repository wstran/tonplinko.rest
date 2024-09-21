import type { UserWithNonce } from "../../types";
import { useUser } from "../../hooks/useUser";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    const { task_id, action } = data;

    if (
        typeof task_id !== 'string' || task_id.length > 50 ||
        typeof action !== 'string' || action.length > 50
    ) return;

    try {
        const exists = await useUser(user.tele_id, async (user) => {
            const task_config = await user.getTaskConfig();

            if (!task_config || !task_config[task_id]?.task_list[action]) return;

            const is_action_done = user.isTaskAction(task_id, action);

            if (!is_action_done) {
                const created_at = new Date();

                user.setTaskAction(task_id, action, created_at);

                replyMessage(data.return_action, { created_at });
            };
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
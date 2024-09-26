import type { UserWithNonce } from "../../types";
import { useUser } from "../../hooks/useUser";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    const { task_id } = data;

    if (typeof task_id !== 'string' || task_id.length > 50) return;

    try {
        const exists = await useUser(user.tele_id, async (user) => {
            const task_config = await user.getTaskConfig();

            if (!task_config) return;

            const is_task_done = Object.keys(task_config[task_id]?.task_list).findIndex((action) => !user.isTaskActionFinish(task_id, action)) === -1;

            if (!is_task_done) {
                replyMessage('receiver_message_data', { content: 'You have not completed the task', type: 'error' });
                return;
            };

            if (user.isTaskFinish(task_id)) {
                replyMessage('receiver_message_data', { content: 'You have already claimed this task', type: 'error' });
                return;
            };

            const created_at = new Date();

            for (const [reward_name, reward_data] of task_config[task_id].task_rewards) {
                if (reward_data.type === "token") {
                    if (reward_name === 'ton') user.addTONBalance(reward_data.amount, created_at);
                    if (reward_name === 'tpl') user.addTPLBalance(reward_data.amount, created_at);
                };
            };

            user.setTaskFinish(task_id, created_at);

            replyMessage(data.return_action, { task_id, created_at });
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
import type { UserWithNonce } from "../../types";
import { useUser } from "../../hooks/useUser";
import Database from "../../libs/database";
import { generateRandomNumber } from "../../libs/custom";
import { Address, toNano } from "@ton/core";

export default async (user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    const { amount, address } = data;

    if (
        Number.isFinite(amount) === false ||
        amount <= 0 || amount > 5_000_000_000 ||
        Address.isFriendly(address) === false
    ) return;

    try {
        const exists = await useUser(user.tele_id, async (user) => {
            const ton_balance = user.getTONBalance();

            if (ton_balance < amount) {
                replyMessage('receiver_message_data', { content: 'You do not have enough balance to deposit', type: 'error' });
                return;
            };

            const withdraw_config = await user.getWithdrawConfig();

            const dbInstance = Database.getInstance();
            const db = await dbInstance.getDb();
            const client = dbInstance.getClient();
            const todoCollection = db.collection('todos');

            const created_at = new Date();

            const estimate_at = new Date(created_at.getTime() + (1000 * 60 * 5));

            const invoice_id = 'W' + generateRandomNumber(16);

            const onchain_amount = toNano(amount).toString();

            const session = client.startSession({
                defaultTransactionOptions: {
                    readConcern: { level: 'local' },
                    writeConcern: { w: 1 },
                    retryWrites: false
                }
            });

            try {
                await session.withTransaction(async () => {
                    const update_todo_result = await todoCollection.updateOne(
                        { todo_type: 'rest:onchain/repay', tele_id: user.tele_id, status: 'pending' },
                        {
                            $setOnInsert: {
                                todo_type: 'rest:onchain/repay',
                                tele_id: user.tele_id,
                                status: withdraw_config.state === 'approve' ? 'approving' : 'pending',
                                onchain_amount,
                                invoice_id,
                                address,
                                amount,
                                estimate_at,
                                created_at,
                            },
                        },
                        { upsert: true, session },
                    );

                    if (update_todo_result.acknowledged === true) {
                        const removed = user.removeTONBalance(amount, created_at);

                        if (removed === false) throw new Error('Failed to remove balance');
                    } else {
                        throw new Error('Failed to update todo');
                    };
                });
            } catch (error) {
                return console.error(error);
            } finally {
                await session.endSession();
            };

            replyMessage(data.return_action, { invoice_id, onchain_amount, created_at });
        });

        if (exists === false) replyMessage('receiver_action_data', { action: 'reload' });
    } catch (error) {
        console.error(error);
    };
}
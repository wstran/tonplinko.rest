import redisWrapper from "../../libs/redisWrapper";
import type { UserWithNonce } from "../../types";

export default async (ws_user: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    if (typeof data.projection !== 'string') return;

    try {
        const user = await redisWrapper.get("users", ws_user.tele_id) as Record<string, any>;

        delete user._id;

        let response_user: Record<string, any> = {};

        if (data.projection === '*') {
            response_user = { ...user };
        } else {
            const porjections = data.projection.split(' ');

            for (const projection of porjections) {
                response_user[projection] = user[projection];
            };
        };
        
        replyMessage(data.return_action, response_user);
    } catch (error) {
        console.error(error);
    };
}
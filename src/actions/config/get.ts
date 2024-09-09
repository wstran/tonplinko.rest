import redisWrapper from "../../libs/redisWrapper";
import type { UserWithNonce } from "../../types";

export default async (_: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    let response_config: Record<string, any> = {};

    if (data.projection === '*') {
        const all_config = await redisWrapper.get_all('config');

        for (const key in all_config) {
            delete all_config[key]._id;
        };

        response_config = all_config;
    } else {
        const porjections = data.projection.split(' ');

        for (const projection of porjections) {
            const config = await redisWrapper.get('config', projection) as Record<string, any>;

            if (config === null) continue;

            delete config._id;

            response_config[projection] = config;
        };
    };

    replyMessage(data.return_action, response_config);
}
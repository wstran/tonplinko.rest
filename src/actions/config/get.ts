import redisWrapper from "../../libs/redisWrapper";
import type { UserWithNonce } from "../../types";

export default async (_: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    let response_config: Record<string, any> = {};

    if (data.projection === '*') {
        const all_config = await redisWrapper.get_all('config');

        response_config = Object.values(all_config).reduce((acc, config) => {
            delete config._id;

            return { ...acc, ...config };
        }, {});
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
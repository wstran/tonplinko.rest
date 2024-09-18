import redisWrapper from "../../libs/redisWrapper";
import type { UserWithNonce } from "../../types";

export default async (_: UserWithNonce, data: Record<string, any>, replyMessage: (return_action: string, data: Record<string, any>) => void) => {
    let response_config: Record<string, any> = {};

    if (data.projection === '*') {
        const all_config = await redisWrapper.get_all('config');

        response_config = Object.values(all_config).map(i => Object.entries(i)).reduce((acc, config) => {
            const [key, value] = [config[0][0], config[0][1]];

            delete value._id;

            delete value.config_type;

            return { ...acc, [key]: value };
        }, {} as Record<string, any>);
    };

    replyMessage(data.return_action, response_config);
}
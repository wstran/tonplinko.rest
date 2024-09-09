import fs from 'fs';
import path from 'path';

const folders = fs.readdirSync('./src/actions');

const all_actions: { [key: string]: any } = {};

for (const folder of folders) {
    if (!folder.includes('.')) {
        const actions = fs.readdirSync('./src/actions/' + folder);

        for (const action of actions) {
            if (action.includes('.')) {
                const worker_path = path.join('./src/actions/', folder + '/' + action);

                const value = await import('../../' + worker_path);

                all_actions[`${folder}/${action.slice(0, action.length - 3)}`] = value.default;
            };
        };
    };
};

export default all_actions;
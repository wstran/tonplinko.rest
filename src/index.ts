const { PORT, REDIS_URL, TELEGRAM_BOT_TOKEN, ROOT_SECRET, SERVER_SECRET, SERVER_DOMAIN } = Bun.env;

if (
    !PORT ||
    !REDIS_URL ||
    !TELEGRAM_BOT_TOKEN ||
    !ROOT_SECRET ||
    !SERVER_SECRET ||
    !SERVER_DOMAIN
) {
    throw new Error('Environment variables are not set.');
};

import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import geoip from 'geoip-lite';
import type { Location, User, UserWithNonce, WS_DATA } from './types';
import Database from './libs/database';
import { generateRandomInt, generateRandomUpperString } from './libs/custom';
import redisWrapper from './libs/redisWrapper';
import { createToken, verifyToken } from './libs/jsonwebtoken';
import actions from './actions';
import { rateLimitMiddleware, rateLimitWebSocket } from './libs/limitter';

(async () => {
    const dbInstance = Database.getInstance();
    const db = await dbInstance.getDb();
    const configCollection = db.collection('config');
    const userCollection = db.collection('users');
    const logCollection = db.collection('logs');
    const locationCollection = db.collection('locations');

    // indexes of config
    await configCollection.createIndex({ 'config_type': 1 });

    // indexes of users
    await userCollection.createIndex({ 'tele_id': 1 }, { unique: true });
    await userCollection.createIndex({ 'referral_code': 1 }, { unique: true });
    await userCollection.createIndex({ 'referraled_by': 1 }, { sparse: true });
    await userCollection.createIndex({ 'username': 1 }, { sparse: true });
    await userCollection.createIndex({ 'wallet.address': 1 }, { sparse: true });

    // indexes of logs
    await logCollection.createIndex({ log_type: 1, tele_id: 1 });

    // indexes of locations
    await locationCollection.createIndex({ tele_id: 1, ip_address: 1 }, { unique: true });

    const config_type_from_ids: Record<string, string> = {};

    const configs = await configCollection.find().toArray();

    await redisWrapper.transaction(['lock:config'], 15, async () => {
        await Promise.all([
            ...configs.map(async (config) => {
                config_type_from_ids[config._id.toHexString()] = config.config_type;
                await redisWrapper.set('config', config.config_type, config);
            })
        ]);
    });

    const change_stream = configCollection.watch();

    change_stream.on('change', async (change) => {
        if (await redisWrapper.is_locked('lock:config')) return;

        if (change.operationType === 'insert') {
            change.fullDocument && await redisWrapper.transaction(['lock:config'], 15, async () => {
                config_type_from_ids[change.fullDocument._id.toHexString()] = change.fullDocument.config_type;
                await redisWrapper.set('config', change.fullDocument.config_type, change.fullDocument);
            });
        } else if (change.operationType === 'update') {
            await redisWrapper.transaction(['lock:config'], 15, async () => {
                const updated_config = await configCollection.findOne({ _id: change.documentKey._id });

                if (updated_config !== null) {
                    config_type_from_ids[change.documentKey._id.toHexString()] = updated_config.config_type;

                    await redisWrapper.set('config', updated_config.config_type, updated_config);
                };
            });
        } else if (change.operationType === 'delete') {
            await redisWrapper.transaction(['lock:config'], 15, async () => {
                const hex_id = change.documentKey._id.toHexString();
                const config_type = config_type_from_ids[hex_id];

                delete config_type_from_ids[hex_id]

                await redisWrapper.del('config', config_type);
            });
        };
    });
})();

geoip.reloadDataSync();

const headers = {
    'Access-Control-Allow-Origin': Bun.env.NODE_ENV === 'production' ? SERVER_DOMAIN : 'http://localhost:5001',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type, --webapp-init, --webapp-hash',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
};

const server = Bun.serve({
    port: PORT,
    async fetch(req, server) {
        const rate_limit_response = rateLimitMiddleware(req);

        if (rate_limit_response) return rate_limit_response;

        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

        const accessToken = new URL(req.url).searchParams.get('accessToken');

        if (server.upgrade(req, { data: { accessToken } })) return;

        if (req.method === 'POST' && new URL(req.url).pathname === '/api/auth') {
            if (Bun.env.NODE_ENV === 'development') {
                let clientIp = '8.8.8.8';

                if (Array.isArray(clientIp)) clientIp = clientIp[0] as string;

                if (clientIp.includes(',')) clientIp = clientIp.split(', ')[0];

                const lookup = geoip.lookup(clientIp);

                if (lookup === null) return new Response('Bad request.', { status: 400, headers });

                const formattedLocation: Location = {
                    ip_address: clientIp,
                    country_code: lookup.country,
                    region_code: lookup.region,
                    city_name: lookup.city,
                    latitude: lookup.ll[0],
                    longitude: lookup.ll[1],
                    timezone: lookup.timezone || 'Unknown'
                };

                const user = {
                    tele_id: '123456789',
                    name: 'Biki',
                    username: 'biki',
                    balances: { tpl: 100000 },
                    auth_date: new Date(),
                } as User;

                const nonce = generateRandomInt(100000000000000, 999999999999999).toString();

                const token = createToken({ ...user, nonce }, '1h');

                try {
                    await redisWrapper.transaction([
                        `lock:users:${user.tele_id}`,
                        `lock:locations:${user.tele_id}`,
                        `lock:nonces:${user.tele_id}`
                    ], 15, async () => {
                        const locations = await redisWrapper.get('locations', user.tele_id) as [] || [];

                        await Promise.all([
                            redisWrapper.set('users', user.tele_id, user),
                            redisWrapper.set('locations', user.tele_id,
                                (locations.findIndex((i: Location) => i.ip_address === clientIp) === -1 ? [
                                    ...(locations as [] || []),
                                    {
                                        tele_id: user.tele_id,
                                        ...formattedLocation,
                                        last_active_at: new Date(),
                                    }
                                ] : [...(locations as [] || [])]
                                )
                            ),
                            redisWrapper.set_ttl(`nonces:${user.tele_id}`, nonce, 60 * 60),
                        ]);
                    });
                } catch (error) {
                    console.error(error);
                    return new Response('Internal server error.', { status: 500 });
                };

                return new Response(JSON.stringify({ token }), { status: 200, headers });
            };

            const [webapp_init, webapp_hash] = [req.headers.get('--webapp-init'), req.headers.get('--webapp-hash')];

            if (typeof webapp_init !== 'string' || typeof webapp_hash !== 'string') return new Response('Bad request.', { status: 400, headers });

            const [timestamp, request_hash] = webapp_hash.split(':');

            if (typeof timestamp !== 'string' || typeof request_hash !== 'string') return new Response('Bad request.', { status: 400, headers });

            const now_date = new Date();

            if (Number(timestamp) + 4000 < now_date.getTime()) return new Response('Bad request.', { status: 400, headers });

            let dataToSign = `timestamp=${timestamp}&initData=${webapp_init}`;

            if (req.body !== null) {
                const data = JSON.stringify(req.body);

                dataToSign += `&data=${data}`;
            };

            const server_signature = new Bun.MD5().update(Bun.env.ROOT_SECRET + dataToSign).digest('hex');

            if (server_signature !== request_hash) return new Response('Bad request.', { status: 400, headers });

            const params = new URLSearchParams(decodeURIComponent(webapp_init));

            const hash = params.get('hash');

            params.delete('hash');

            const secret_key = CryptoJS.HmacSHA256(TELEGRAM_BOT_TOKEN, 'WebAppData');

            const data_check_string = Array.from(params.entries()).sort().map(e => `${e[0]}=${e[1]}`).join('\n');

            const hmac = CryptoJS.HmacSHA256(data_check_string, secret_key).toString(CryptoJS.enc.Hex);

            if (hmac !== hash) return new Response('Invalid user data.', { status: 403, headers });

            const user_param = params.get('user');

            const auth_date = Number(params.get('auth_date')) * 1000;

            if (typeof user_param !== 'string' || isNaN(auth_date)) return new Response('Bad request.', { status: 400, headers });

            let clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || req.headers.get('remote-address');

            if (typeof clientIp !== 'string') return new Response('Bad request.', { status: 400, headers });

            if (Array.isArray(clientIp)) clientIp = clientIp[0] as string;

            if (clientIp.includes(',')) clientIp = clientIp.split(', ')[0];

            const lookup = geoip.lookup(clientIp);

            if (lookup === null) return new Response('Bad request.', { status: 400, headers });

            const formattedLocation: Location = {
                ip_address: clientIp,
                country_code: lookup.country,
                region_code: lookup.region,
                city_name: lookup.city,
                latitude: lookup.ll[0],
                longitude: lookup.ll[1],
                timezone: lookup.timezone || 'Unknown'
            };

            const parse_user = JSON.parse(user_param);

            const tele_id = String(parse_user.id);

            const user = {
                tele_id,
                name: [parse_user.first_name, parse_user.last_name].join(' '),
                username: parse_user.username,
                auth_date: new Date(auth_date),
            } as User;

            return await redisWrapper.transaction([
                `lock:users:${tele_id}`,
                `lock:locations:${tele_id}`,
                `lock:nonces:${tele_id}`
            ], 15, async () => {
                const user_data = await redisWrapper.get('users', tele_id) as Record<string, any>;

                const nonce = generateRandomInt(100000000000000, 999999999999999).toString();

                const token = createToken({ ...user, nonce }, '1h');

                if (user_data) {
                    const response_user = Object.assign(
                        user,
                        user_data,
                        {
                            last_active_at: now_date,
                            ip_location: formattedLocation
                        }
                    );

                    try {
                        await Promise.all([
                            redisWrapper.set('users', tele_id, response_user),
                            redisWrapper.set('locations', tele_id, [
                                ...(await redisWrapper.get('locations', tele_id) as [] || []),
                                {
                                    tele_id,
                                    ...formattedLocation,
                                    last_active_at: now_date,
                                }
                            ]),
                            redisWrapper.set_ttl(`nonces:${user.tele_id}`, nonce, 60 * 60)
                        ]);
                    } catch (error) {
                        console.error(error);
                        return new Response('Internal server error.', { status: 500 });
                    };

                    return new Response(JSON.stringify({ token }), { status: 200, headers });
                } else {
                    const dbInstance = Database.getInstance();
                    const db = await dbInstance.getDb();
                    const client = dbInstance.getClient();
                    const userCollection = db.collection('users');
                    const todoCollection = db.collection('todos');
                    const locationCollection = db.collection('locations');

                    const session = client.startSession({
                        defaultTransactionOptions: {
                            readConcern: { level: 'local' },
                            writeConcern: { w: 1 },
                            retryWrites: false
                        }
                    });

                    try {
                        await session.withTransaction(async () => {
                            const referraled_by_code = params.get('start_param');

                            const insert: { created_at?: Date; referral_code?: string; referraled_by?: string, referraled_by_code?: string } = {};

                            const is_new = await userCollection.countDocuments({ tele_id }, { session }) === 0;

                            while (is_new) {
                                const generate_invite = generateRandomUpperString(14);

                                if (generate_invite !== referraled_by_code && await userCollection.countDocuments({ referral_code: generate_invite }, { session }) === 0) {
                                    insert.created_at = now_date;
                                    insert.referral_code = generate_invite;

                                    if (typeof referraled_by_code === 'string') {
                                        const referral_user = await userCollection.findOne({ referral_code: referraled_by_code }, { projection: { _id: 0, tele_id: 1 }, session });

                                        if (referral_user !== null) {
                                            insert.referraled_by = referral_user.tele_id;
                                            insert.referraled_by_code = referraled_by_code;
                                        };
                                    };
                                    break;
                                };
                            };

                            const update_user = {
                                name: user.name,
                                username: user.username,
                                auth_date: user.auth_date,
                                last_active_at: now_date,
                                ip_location: formattedLocation,
                                farm_level: 1,
                            };

                            const [update_user_result, update_location_result, insert_todo_result] = await Promise.all([
                                userCollection.findOneAndUpdate(
                                    { tele_id },
                                    {
                                        $set: update_user,
                                        $setOnInsert: insert,
                                    },
                                    {
                                        upsert: true,
                                        returnDocument: 'after',
                                        projection: { _id: 0 },
                                        session
                                    }
                                ),
                                locationCollection.updateOne(
                                    {
                                        tele_id,
                                        ip_address: clientIp,
                                    },
                                    {
                                        $set: { ...formattedLocation, last_active_at: now_date },
                                        $setOnInsert: { tele_id, created_at: now_date },
                                    },
                                    { upsert: true, session }
                                ),
                                !!insert.referraled_by && todoCollection.insertOne(
                                    {
                                        todo_type: 'rest:add/referral/user',
                                        tele_id: tele_id,
                                        referraled_by: insert.referraled_by,
                                        created_at: now_date,
                                        status: "pending",
                                    },
                                    { session },
                                )
                            ]);

                            if (update_user_result === null && update_location_result.acknowledged !== true || (insert_todo_result !== false && insert_todo_result.acknowledged !== true)) {
                                throw new Error('Transaction failed to commit.');
                            };

                            const user_data = {
                                ...update_user_result,
                                ...update_user,
                            };

                            await Promise.all([
                                redisWrapper.set('users', tele_id, user_data),
                                redisWrapper.set_ttl(`nonces:${user.tele_id}`, nonce, 60 * 60),
                            ]);
                        });

                        return new Response(JSON.stringify({ token }), { status: 200, headers });
                    } catch (error) {
                        console.error(error);
                        return new Response('Internal server error.', { status: 500 });
                    } finally {
                        await session.endSession();
                    };
                };
            });
        };
    },
    websocket: {
        message(ws, message) {
            if (ws.readyState !== WebSocket.OPEN) return;

            const ws_data = ws.data as WS_DATA;

            const rate_limit_socket = rateLimitWebSocket(ws, ws_data.clientIp as string);

            if (ws_data.clientIp && rate_limit_socket) return;


            if (!ws_data.isAuthenticated) return ws.close(4003, 'Unauthorized');

            const ws_message = message.toString();

            if (!ws_data.sharedKey && ws_message.startsWith('i:')) {
                const client_public_key = ws_message.split('i:')[1];

                const diffHellServer = crypto.getDiffieHellman("modp5");

                diffHellServer.generateKeys('base64');

                const sharedKey = (diffHellServer.computeSecret as any)(Buffer.from(client_public_key, 'base64'));

                const sharedKeyPadded = crypto.createHash("sha256").update(sharedKey).digest().slice(0, 16);

                (ws.data as WS_DATA).sharedKey = sharedKeyPadded;

                (ws.data as WS_DATA).signature = (crypto.createHash('md5').update as any)(sharedKeyPadded).digest('hex');

                ws.send(`i:${diffHellServer.getPublicKey('base64')}`);

                return;
            };

            if (ws_data.sharedKey && ws_message.startsWith('m:')) {
                const [_, signature, encrypted_message] = ws_message.split(':');

                if (signature !== ws_data.signature) return ws.close(4004, 'Unauthorized');

                try {
                    const decipher = (crypto.createDecipheriv as any)('aes-128-cbc', ws_data.sharedKey, ws_data.sharedKey);

                    const decrypted = [decipher.update(encrypted_message, 'base64', 'utf8'), decipher.final('utf8')].join('');

                    const message = JSON.parse(decrypted);

                    const sharedKey = ws_data.sharedKey;

                    actions[message.action]?.((ws.data as WS_DATA).user, message.data, (return_action: string, data: Record<string, any>) => {

                        const cipher = (crypto.createCipheriv as any)('aes-128-cbc', sharedKey, sharedKey);

                        let encrypted = [cipher.update(JSON.stringify({ return_action, data }), 'utf8', 'base64'), cipher.final('base64')].join('');

                        ws.send(`m:${signature}:${JSON.stringify(encrypted)}`);
                    });
                } catch (error) {
                    console.error(error);
                };

                return;
            };
        },

        async open(ws) {
            try {
                if (ws.readyState !== WebSocket.OPEN) return;

                const ws_data = ws.data as WS_DATA;

                const accessToken = ws_data.accessToken || '';

                if (!accessToken) return ws.close(4000, 'Invalid token');

                const verifiedToken = verifyToken(accessToken) as UserWithNonce;

                const { tele_id } = verifiedToken;

                if (!await redisWrapper.has_ttl(`nonces:${tele_id}`)) return ws.close(4001, 'Unauthorized');

                (ws.data as WS_DATA).isAuthenticated = true;

                (ws.data as WS_DATA).user = verifiedToken;

                (ws.data as WS_DATA).clientIp = ws.remoteAddress;
            } catch (error: any) {
                if (error?.name === 'TokenExpiredError') {
                    return ws.close(4001, 'Token expired');
                };

                return ws.close(1013, 'Internal server error');
            };
        },

        async close(ws) {
            const ws_data = ws.data as { user?: UserWithNonce };

            if (ws_data.user?.tele_id && ws_data.user?.nonce) {
                const { tele_id } = ws_data.user;

                const dbInstance = Database.getInstance();
                const db = await dbInstance.getDb();
                const client = dbInstance.getClient();
                const userCollection = db.collection('users');
                const locationCollection = db.collection('locations');
                const logCollection = db.collection('logs');

                const session = client.startSession({
                    defaultTransactionOptions: {
                        readConcern: { level: 'local' },
                        writeConcern: { w: 1 },
                        retryWrites: false
                    }
                });

                try {
                    await redisWrapper.transaction([
                        `lock:users:${tele_id}`,
                        `lock:locations:${tele_id}`,
                        `lock:logs:${tele_id}`,
                        `lock:nonces:${tele_id}`,
                    ], 15, async () => {
                        if (Bun.env.NODE_ENV === 'development') {
                            await Promise.all([
                                redisWrapper.del('users', tele_id),
                                redisWrapper.del('locations', tele_id),
                                redisWrapper.del('logs', tele_id),
                                redisWrapper.del_ttl(`nonces:${tele_id}`),
                            ]);
                        } else {
                            await session.withTransaction(async () => {
                                const [user_data, locations, logs] = await Promise.all([
                                    redisWrapper.get('users', tele_id),
                                    redisWrapper.get('locations', tele_id),
                                    redisWrapper.get('logs', tele_id),
                                ]) as [User, [], []];

                                const now_date = new Date();

                                const locationBulks = (locations || []).map((location: Location) => ({
                                    updateOne: {
                                        filter: { tele_id, ip_address: location.ip_address },
                                        update: { $set: { ...location, last_active_at: now_date } },
                                    }
                                }));

                                const [update_user_result, update_location_result, insert_log_result] = await Promise.all([
                                    userCollection.updateOne(
                                        { tele_id },
                                        { $set: { ...user_data, last_active_at: now_date } },
                                        { session }
                                    ),
                                    locationBulks.length > 0 && locationCollection.bulkWrite(locationBulks, { session }),
                                    (logs !== null && logs.length > 0) && logCollection.insertMany(logs, { session }),
                                ]);

                                if (
                                    update_user_result.acknowledged !== true ||
                                    (insert_log_result !== false && insert_log_result.acknowledged !== true) ||
                                    (update_location_result !== false && update_location_result.isOk() !== true)) {
                                    throw new Error('Transaction failed to commit.');
                                };

                                await Promise.all([
                                    redisWrapper.del('users', tele_id),
                                    redisWrapper.del('locations', tele_id),
                                    redisWrapper.del('logs', tele_id),
                                    redisWrapper.del_ttl(`nonces:${tele_id}`),
                                ]);
                            });
                        };
                    });
                } catch (error) {
                    console.error(error);
                } finally {
                    await session.endSession();
                };
            };
        },
    },
});

console.log(`Server is running on port ${server.url}`);
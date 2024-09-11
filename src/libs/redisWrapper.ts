import IORedis from "ioredis";

const redisClient = new IORedis(Bun.env.REDIS_URL!, { retryStrategy: (times) => Math.min(times * 50, 2000) });

async function transaction(keys: string[], ttl: number, callback: Function) {
    await Promise.all(keys.map(async (key) => await await_unlock(key)));

    await Promise.all(keys.map(async (key) => await lock(key, ttl)));

    const result = await callback();

    await Promise.all(keys.map(async (key) => await unlock(key)));

    return result;
}

async function lock(key: string, ttl: number) {
    return await redisClient.set(key, 'locked', 'EX', ttl);
}

async function is_locked(key: string) {
    return (await redisClient.get(key)) === 'locked';
}

async function await_unlock(key: string, interval: number = 1000) {
    let ttl_exists = await has_ttl(key);

    while (ttl_exists) {
        await new Promise(resolve => setTimeout(resolve, interval));
        ttl_exists = await has_ttl(key);
    };

    return true;
}

async function unlock(key: string) {
    await redisClient.del(key);
}

const get_all = async (key: string) => {
    const users = await redisClient.hgetall(key);
    
    return Object.entries(users).map(([key, value]) => ({ [key]: JSON.parse(value) }));
}

const has = async (key: string, field: string) => {
    return (await redisClient.hexists(key, field)) === 1;
}

const get = async (key: string, field: string, returnType?: 'raw'): Promise<Record<string, any> | string | null> => {
    const data = await redisClient.hget(key, field);

    return data ? (returnType === 'raw' ? data : JSON.parse(data)) : null;
}

const set = async (key: string, field: string, value: Record<string, any>) => {
    return await redisClient.hset(key, field, JSON.stringify(value));
}

const del = async (key: string, field: string) => {
    return await redisClient.hdel(key, field);
}

const get_ttl = async (key: string) => {
    const ttl = await redisClient.getex(key);

    return ttl;
}

const set_ttl = async (key: string, value: string, ttl: number) => {
    return await redisClient.set(key, value, 'EX', ttl);
}

const has_ttl = async (key: string) => {
    return (await redisClient.exists(key)) === 1;
}

const del_ttl = async (key: string) => {
    await redisClient.del(key);
}

const list_get = async (key: string, index: number, returnType?: 'raw'): Promise<Record<string, any> | string | null> => {
    const data = await redisClient.lindex(key, index);

    return data ? (returnType === 'raw' ? data : JSON.parse(data)) : null;
}

const list_get_all = async (key: string, returnType?: 'raw'): Promise<Record<string, any>[] | string[]> => {
    const data = await redisClient.lrange(key, 0, -1);

    return data.map((item) => returnType === 'raw' ? item : JSON.parse(item));
}

const list_push = async (key: string, value: Record<string, any>) => {
    return await redisClient.lpush(key, JSON.stringify(value));
}

const list_assign = async (key: string, index: number, value: Record<string, any>[]) => {
    const get_data = await list_get(key, index) as Record<string, any>;

    if (get_data) {
        await redisClient.lset(key, index, JSON.stringify({ ...get_data, ...value }));
        
        return true;
    };

    return false;
}

const list_clear = async (key: string) => {
    return await redisClient.ltrim(key, 1, 0);
}

export default { transaction, lock, is_locked, await_unlock, unlock, get_all, has, get, set, del, get_ttl, set_ttl, has_ttl, del_ttl, list_get, list_get_all, list_push, list_assign, list_clear, redisClient };
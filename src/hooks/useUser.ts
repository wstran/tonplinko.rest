import redisWrapper from "../libs/redisWrapper";

export const getBinRisk = async (row: number, risk_level: string, bin: number) => {
    const config = await redisWrapper.get('config', 'bin_payouts') as Record<string, any>;

    return config[row]?.[risk_level]?.[bin];
}

export const getTPPBalance = async (tele_id: string) => {
    return (await redisWrapper.get('users', tele_id) as Record<string, any>)?.balances?.tpp || 0;   
}

export const setTPPBalance = async (tele_id: string, amount: number) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, balances: { ...previous.balances, tpp: amount } });

    return true;
}

export const addTPPBalance = async (tele_id: string, amount: number) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, balances: { ...previous.balances, tpp: (previous.balances?.tpp || 0) + amount } });

    return true;
}

export const removeTPPBalance = async (tele_id: string, amount: number) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null || (previous.balances?.tpp || 0) < amount) return false;

    await redisWrapper.set('users', tele_id, { ...previous, balances: { ...previous.balances, tpp: (previous.balances?.tpp || 0) - amount } });

    return true;
}

export const setInventoryItem = async (tele_id: string, item_name: string, item_amount: number) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, inventorys: { [item_name]: item_amount } });

    return true;
}

export const addInventoryItem = async (tele_id: string, item_name: string, item_amount: number) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, inventorys: { ...previous.inventorys, [item_name]: (previous.inventorys[item_name] || 0) + item_amount } });

    return true;
}

export const removeInventoryItem = async (tele_id: string, item_name: string, item_amount: number) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null || previous.inventorys[item_name] || 0 < item_amount) return false;

    await redisWrapper.set('users', tele_id, { ...previous, inventorys: { ...previous.inventorys, [item_name]: (previous.inventorys[item_name] || 0) - item_amount } });
    
    return true;
}

export const addLog = async (tele_id: string, log: Record<string, any>) => {
    const previous = await redisWrapper.get('logs', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('logs', tele_id, { ...previous, logs: [...previous.logs, log] });
}

export const useUser = async (tele_id: string, handler: () => Promise<void>) => {
    return await redisWrapper.has('users', tele_id) && await redisWrapper.transaction([
        `lock:users:${tele_id}`,
        `lock:locations:${tele_id}`,
        `lock:nonces:${tele_id}`,
        `lock:logs:${tele_id}`,
    ], 15, handler);
}
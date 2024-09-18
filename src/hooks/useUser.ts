import Decimal from "decimal.js";
import redisWrapper from "../libs/redisWrapper";

// USER
export const getUser = async (tele_id: string) => {
    return await redisWrapper.get('users', tele_id) as Record<string, any>;
}

export const getFarmLevel = async (tele_id: string) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null || !previous.farm_level) return null;

    return previous.farm_level;
}

export const setFarmLevel = async (tele_id: string, farm_level: number, created_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, farm_level, actions: { ...previous.actions, set_farm_level_at: created_at } });

    return true;
}

export const isUserFarmed = async (tele_id: string) => {
    return !!(await redisWrapper.get('users', tele_id) as Record<string, any>)?.farm_at;
}

export const setUserFarmed = async (tele_id: string, farm_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, farm_at, actions: { ...previous.actions, set_farm_at: farm_at } });

    return true;
}

export const unSetUserFarmed = async (tele_id: string, created_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    delete previous.farm_at;

    await redisWrapper.set('users', tele_id, { ...previous, actions: { ...previous.actions, unset_farm_at: created_at } });

    return true;
}

export const getTPLBalance = async (tele_id: string) => {
    return (await redisWrapper.get('users', tele_id) as Record<string, any>)?.balances?.tpl || 0;   
}

export const setTPLBalance = async (tele_id: string, amount: number, created_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, balances: { ...previous.balances, tpl: amount }, actions: { ...previous.actions, set_tpl_balance_at: created_at } });

    return true;
}

export const addTPLBalance = async (tele_id: string, amount: number, created_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, balances: { ...previous.balances, tpl: new Decimal((previous.balances?.tpl || 0)).plus(amount).toNumber() }, actions: { ...previous.actions, add_tpl_balance_at: created_at } });

    return true;
}

export const removeTPLBalance = async (tele_id: string, amount: number, created_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null || (previous.balances?.tpl || 0) < amount) return false;

    await redisWrapper.set('users', tele_id, { ...previous, balances: { ...previous.balances, tpl: new Decimal((previous.balances?.tpl || 0)).minus(amount).toNumber() }, actions: { ...previous.actions, remove_tpl_balance_at: created_at } });

    return true;
}

export const setInventoryItem = async (tele_id: string, item_name: string, item_amount: number, created_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, inventorys: { [item_name]: item_amount }, actions: { ...previous.actions, set_inventory_item_at: created_at } });

    return true;
}

export const addInventoryItem = async (tele_id: string, item_name: string, item_amount: number, created_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null) return false;

    await redisWrapper.set('users', tele_id, { ...previous, inventorys: { ...previous.inventorys, [item_name]: (previous.inventorys[item_name] || 0) + item_amount }, actions: { ...previous.actions, add_inventory_item_at: created_at } });

    return true;
}

export const removeInventoryItem = async (tele_id: string, item_name: string, item_amount: number, created_at: Date) => {
    const previous = await redisWrapper.get('users', tele_id) as Record<string, any>;

    if (previous === null || previous.inventorys[item_name] || 0 < item_amount) return false;

    await redisWrapper.set('users', tele_id, { ...previous, inventorys: { ...previous.inventorys, [item_name]: (previous.inventorys[item_name] || 0) - item_amount }, actions: { ...previous.actions, remove_inventory_item_at: created_at } });

    return true;
}

// CONFIG
export const getBinRisk = async (row: number, risk_level: string, bin: number) => {
    const config = await redisWrapper.get('config', 'bin_payouts') as Record<string, any>;

    return config[row]?.[risk_level]?.[bin];
}

export const getFarmConfig = async () => {
    const config = await redisWrapper.get('config', 'farm') as Record<string, any>;

    return config;
}

// LOG
export const getLogs = async (tele_id: string) => {
    return (await redisWrapper.get('logs', tele_id) as Record<string, any>)?.logs || [];
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
        `lock:logs:${tele_id}`,
        `lock:nonces:${tele_id}`,
    ], 15, handler);
}
import Decimal from "decimal.js";
import redisWrapper from "../libs/redisWrapper";

class User {
    public tele_id: string;
    private _user?: Record<string, any>;


    constructor(tele_id: string) {
        this.tele_id = tele_id;
    };

    // USER
    async init() {
        this._user = await redisWrapper.get('users', this.tele_id) as Record<string, any>;
    };

    getUser() {
        return this._user;
    };

    isTaskActionFinish(task_id: string, action: string) {
        return !!this._user?.tasks?.[task_id]?.[action];
    };

    setTaskActionFinish(task_id: string, action: string, created_at: Date) {
        if (!this._user) return false;

        this._user.tasks = { ...this._user?.tasks, [task_id]: { ...this._user?.tasks?.[task_id], [action]: { created_at } } };
        this._user.actions = { ...this._user.actions, set_task_at: created_at };

        return true;
    };

    isTaskFinish(task_id: string) {
        return !!this._user?.tasks?.[task_id]?._finished;
    };

    setTaskFinish(task_id: string, created_at: Date) {
        if (!this._user) return false;

        this._user.tasks = { ...this._user?.tasks, [task_id]: { ...this._user?.tasks?.[task_id], _finished: { created_at } } };
        this._user.actions = { ...this._user.actions, set_task_finish_at: created_at };

        return true;
    };

    isDepositing() {
        return !!this._user?.is_depositing;
    };

    setDepositing(created_at: Date, estimate_at: Date) {
        if (!this._user) return false;

        this._user.is_depositing = true;
        this._user.estimate_at = estimate_at;
        this._user.actions = { ...this._user.actions, set_is_depositingat: created_at };

        return true;
    };

    unSetDepositing(created_at: Date) {
        if (!this._user) return false;

        delete this._user.is_depositing;
        delete this._user.estimate_at;
        this._user.actions = { ...this._user.actions, unset_is_depositing_at: created_at };

        return true;
    };

    getTotal(name: string) {
        return this._user?.totals?.[name] || 0;
    };

    setTotal(name: string, amount: number) {
        if (!this._user) return false;

        this._user.totals = { ...this._user.totals, [name]: amount };

        return true;
    };

    addTotal(name: string, amount: number) {
        if (!this._user) return false;

        this._user.totals = { ...this._user.totals, [name]: new Decimal((this._user.totals[name] || 0)).plus(amount).toNumber() };

        return true;
    };

    getRewardPoints() {
        if (!this._user) return null;

        return this._user.referral_reward_points || 0;
    };

    addRewardPoints(referral_reward_points: number, created_at: Date) {
        if (!this._user) return false;

        this._user.referral_reward_points = new Decimal((this._user.referral_reward_points || 0)).plus(referral_reward_points).toNumber();
        this._user.totals = { ...this._user.totals, referral_reward_points: new Decimal((this._user.totals.referral_reward_points || 0)).plus(referral_reward_points).toNumber() };
        this._user.actions = { ...this._user.actions, set_referral_reward_points: created_at };

        return true;
    }

    getAllBoostPercent() {
        if (!this._user) return null;

        const current_timestamp = Date.now();

        return Object.values(this._user.boosts as Record<string, { end_at: Date, percent: number }>).reduce((acc, boost) => {
            return boost.end_at.getTime() > current_timestamp ? new Decimal(acc).plus(boost.percent).toNumber() : acc;
        }, 0);
    };

    addBoost(boost_id: string, percent: number, refs: number, start_at: Date, end_at: Date) {
        if (!this._user) return false;

        if (this._user.boosts) {
            for (const boost_id in this._user.boosts) {
                if (this._user.boosts[boost_id].end_at.getTime() < Date.now()) {
                    delete this._user.boosts[boost_id];
                };
            };
        };

        this._user.boosts = { ...this._user.boosts, [boost_id]: { percent, start_at, end_at, refs } };

        return true;
    };

    editBoost(boost_id: string, data: { percent: number, refs: number, start_at: Date, end_at: Date }) {
        if (!this._user || !this._user.boosts) return false;

        this._user.boosts[boost_id] = { ...this._user.boosts[boost_id], ...data };

        return true;
    };

    removeBoost(boost_id: string) {
        if (!this._user) return false;

        if (this._user.boosts) {
            delete this._user.boosts[boost_id];
        };

        return true;
    };

    getTPLFarmBalance() {
        return this._user?.tpl_farm_balance as number || 0;
    };

    setTPLFarmBalance(amount: number, set_tpl_farm_balance_at: Date) {
        if (!this._user) return false;

        this._user.tpl_farm_balance = amount;
        this._user.set_tpl_farm_balance_at = set_tpl_farm_balance_at;

        return true;
    };

    addTPLFarmBalance(amount: number, add_tpl_farm_balance_at: Date) {
        if (!this._user) return false;

        this._user.tpl_farm_balance = new Decimal(this._user?.tpl_farm_balance || 0).plus(amount).toNumber();
        this._user.add_tpl_farm_balance_at = add_tpl_farm_balance_at;

        return true;
    };

    removeTPLFarmBalance(amount: number, remove_tpl_farm_balance_at: Date) {
        if (!this._user) return false;

        this._user.tpl_farm_balance = new Decimal(this._user?.tpl_farm_balance || 0).minus(amount).toNumber();
        this._user.remove_tpl_farm_balance_at = remove_tpl_farm_balance_at;

        return true;
    };

    getFarmLevel() {
        if (!this._user || !this._user.farm_level) return null;

        return this._user.farm_level;
    };

    setFarmLevel(farm_level: number, created_at: Date) {
        if (!this._user) return false;

        this._user.farm_level = farm_level;
        this._user.actions = { ...this._user.actions, set_farm_level_at: created_at };

        return true;
    };

    isUserFarmed() {
        return !!this._user?.farm_at;
    };

    setUserFarmed(farm_at: Date) {
        if (!this._user) return false;

        this._user.farm_at = farm_at;
        this._user.actions = { ...this._user.actions, set_farm_at: farm_at };

        return true;
    };

    unSetUserFarmed(created_at: Date) {
        if (!this._user) return false;

        delete this._user.farm_at;

        this._user.actions = { ...this._user.actions, unset_farm_at: created_at };

        return true;
    };

    getTPLBalance() {
        return this._user?.balances?.tpl || 0;
    };

    setTPLBalance(amount: number, created_at: Date) {
        if (!this._user) return false;

        this._user.balances = { ...this._user.balances, tpl: amount };
        this._user.actions = { ...this._user.actions, set_tpl_balance_at: created_at };

        return true;
    };

    addTPLBalance(amount: number, created_at: Date) {
        if (!this._user) return false;

        this._user.balances = { ...this._user.balances, tpl: new Decimal((this._user.balances?.tpl || 0)).plus(amount).toNumber() };
        this._user.actions = { ...this._user.actions, add_tpl_balance_at: created_at };

        return true;
    };

    removeTPLBalance(amount: number, created_at: Date) {
        if (!this._user || (this._user.balances?.tpl || 0) < amount) return false;

        this._user.balances = { ...this._user.balances, tpl: new Decimal((this._user.balances?.tpl || 0)).minus(amount).toNumber() };
        this._user.actions = { ...this._user.actions, remove_tpl_balance_at: created_at };

        return true;
    };

    getTONBalance() {
        return this._user?.balances?.ton || 0;
    };

    setTONBalance(amount: number, created_at: Date) {
        if (!this._user) return false;

        this._user.balances = { ...this._user.balances, ton: amount };
        this._user.actions = { ...this._user.actions, set_ton_balance_at: created_at };

        return true;
    };

    addTONBalance(amount: number, created_at: Date) {
        if (!this._user) return false;

        this._user.balances = { ...this._user.balances, ton: new Decimal((this._user.balances?.ton || 0)).plus(amount).toNumber() };
        this._user.actions = { ...this._user.actions, add_ton_balance_at: created_at };

        return true;
    };

    removeTONBalance(amount: number, created_at: Date) {
        if (!this._user || (this._user.balances?.ton || 0) < amount) return false;

        this._user.balances = { ...this._user.balances, ton: new Decimal((this._user.balances?.ton || 0)).minus(amount).toNumber() };
        this._user.actions = { ...this._user.actions, remove_ton_balance_at: created_at };

        return true;
    };

    setInventoryItem(item_name: string, item_amount: number, created_at: Date) {
        if (!this._user) return false;

        this._user.inventorys = { [item_name]: item_amount };
        this._user.actions = { ...this._user.actions, set_inventory_item_at: created_at };

        return true;
    };

    addInventoryItem(item_name: string, item_amount: number, created_at: Date) {
        if (!this._user) return false;

        this._user.inventorys = { ...this._user.inventorys, [item_name]: new Decimal((this._user.inventorys[item_name] || 0)).plus(item_amount).toNumber() };
        this._user.actions = { ...this._user.actions, add_inventory_item_at: created_at };

        return true;
    };

    removeInventoryItem(item_name: string, item_amount: number, created_at: Date) {
        if (!this._user || this._user.inventorys[item_name] || 0 < item_amount) return false;

        this._user.inventorys = { ...this._user.inventorys, [item_name]: new Decimal((this._user.inventorys[item_name] || 0)).minus(item_amount).toNumber() };
        this._user.actions = { ...this._user.actions, remove_inventory_item_at: created_at };

        return true;
    };

    async save() {
        if (!this._user) return false;

        await redisWrapper.set('users', this.tele_id, this._user);

        return true;
    };

    // CONFIG
    async getBinRisk(row: number, risk_level: string, bin: number) {
        const config = await redisWrapper.get('config', 'bin_payouts') as Record<string, any>;

        return config[row]?.[risk_level]?.[bin];
    };

    async getFarmConfig() {
        const config = await redisWrapper.get('config', 'farm') as Record<string, any>;

        return config;
    };

    async getWithdrawConfig() {
        const config = await redisWrapper.get('config', 'withdraw') as Record<string, any>;

        return config;
    };

    async getTaskConfig() {
        const config = await redisWrapper.get('config', 'task') as Record<string, any>;

        return config;
    };

    // LOG
    async getLogs() {
        return (await redisWrapper.get('logs', this.tele_id) as Record<string, any>)?.logs || [];
    };

    async addLog(log: Record<string, any>) {
        const previous = await redisWrapper.get('logs', this.tele_id) as Record<string, any>;

        if (previous === null) return false;

        await redisWrapper.set('logs', this.tele_id, { ...previous, logs: [...previous.logs, log] });

        return true;
    };
}

export const useUser = async (tele_id: string, handler: (user: User) => Promise<any>) => {
    if (!await redisWrapper.has('users', tele_id)) return null;

    return await redisWrapper.transaction([
        `lock:users:${tele_id}`,
        `lock:locations:${tele_id}`,
        `lock:logs:${tele_id}`,
        `lock:nonces:${tele_id}`,
    ], 15, async () => {
        const user = new User(tele_id);

        await user.init();

        try {
            await handler(user);
        } catch(error) {
            console.error(error);
        };

        await user.save();

        return true;
    });
}
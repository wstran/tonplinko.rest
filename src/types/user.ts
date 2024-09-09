export interface User {
    tele_id: string;
    name: string;
    username: string;
    auth_date: Date;
};

export interface UserWithNonce extends User {
    nonce: string;
};

interface TeleUser extends User {
    hash: string;
};

export interface RequestWithUser extends Request {
    tele_user: TeleUser;
};

export interface Location {
    ip_address: string;
    country_code: string;
    region_code: string;
    city_name: string;
    latitude: number;
    longitude: number;
    timezone: string;
};
import jwt from 'jsonwebtoken';

export const createToken = (data: any, expiresIn?: string | number) => {
    return jwt.sign(data, Bun.env.SERVER_SECRET as string, { expiresIn });
}

export const verifyToken = (token: string) => {
    return jwt.verify(token, Bun.env.SERVER_SECRET as string);
}
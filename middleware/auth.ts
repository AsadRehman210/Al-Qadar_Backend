import * as jwt from 'jsonwebtoken';
import { error } from '../source/utility/helper/common';
import * as messages from '../source/utility/helper/constants/message';
import * as Enums from '../source/utility/helper/constants/enum';
import { AccountModel } from '../source/model/account/account-model';
import { userModel } from '../source/model/user/user-model';
import { syncExpiredStatus } from '../source/utility/helper/payment-expiry';

const config = process.env as any;

const verifyToken = async (req: any, res: any, next: any): Promise<void> => {
    let token: string | undefined = req.headers.authorization;
    if (!token) {
         res.json(error(messages.Messages.MSG_TOKEN_REQUIRED, Enums.ErrorCode.token_required));
         return;
    } else {
        token = token.split(" ")[1];
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, config.TOKEN_KEY);
    } catch (err: any) {
         if (err instanceof jwt.TokenExpiredError) {
             res.json(error(messages.Messages.MSG_TOKEN_EXPIRED, Enums.ErrorCode.token_invalid));
             return;
         }
         res.json(error(messages.Messages.MSG_TOKEN_INVALID, Enums.ErrorCode.token_invalid));
         return;
    }

    // Live check, on every request — this is what makes deactivating an
    // account (or a Merchant's payment expiring) take effect immediately,
    // instead of only once the JWT's own expiry eventually arrives.
    try {
        const account = await AccountModel.findOne({ _id: decoded.id });
        if (!account) {
            res.json(error(messages.Messages.MSG_TOKEN_INVALID, Enums.ErrorCode.token_invalid));
            return;
        }
        await syncExpiredStatus(account);
        if (account.status !== Enums.AccountStatus.active) {
            res.json(error(messages.Messages.MSG_USER_DEACTIVATED, Enums.ErrorCode.de_active));
            return;
        }

        // Sub-user session: re-load the user + their Role on every request so
        // deactivating the user, or editing their Role's permissions, takes
        // effect immediately (same philosophy as the Account check above).
        if (decoded.isSubUser && decoded.sub) {
            const subUser = await userModel
                .findOne({ _id: decoded.sub, action_type: { $ne: Enums.ActivityFlag.delete } })
                .populate({ path: 'roleId', select: 'permissions status' });
            if (!subUser || subUser.status !== 'active') {
                res.json(error(messages.Messages.MSG_USER_DEACTIVATED, Enums.ErrorCode.de_active));
                return;
            }
            const role = subUser.roleId as any;
            decoded.permissions = Array.isArray(role?.permissions) ? role.permissions : [];
        }
    } catch (err: any) {
        res.json(error(messages.Messages.MSG_DB_CONNECTION_ERROR, Enums.ErrorCode.exception, err.message));
        return;
    }

    req.user = decoded;
    req.headers.authorization = `Bearer ${token}`;
    next();
};

export {verifyToken};

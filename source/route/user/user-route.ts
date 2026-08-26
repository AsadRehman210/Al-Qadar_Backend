
import 
{ 
    post, 
    getAll, 
    get, 
    deleteByID, 
} from '../../controller/user/user-controller'; 
import { Router } from 'express';
import {verifyToken} from '../../../middleware/auth';

const userRoute = Router();

userRoute
.post('/post',verifyToken, post)
.get('/get-all',verifyToken, getAll)
.get('/get', verifyToken, get)
.post('/delete', verifyToken, deleteByID)





export default userRoute 

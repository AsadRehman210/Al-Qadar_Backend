import mongoose, { Connection } from 'mongoose';

const dbAddress = process.env.DB_ADDRESS || 'mongodb://localhost:27017/genaric_code_auth';
mongoose.connect(dbAddress);

const db: Connection = mongoose.connection;

db.on('error', (error) => console.log(error));
db.once('open', () => console.log(`Connected to database ${process.env.DB_ADDRESS}`));

export interface userDto {
    id: string;
    user_name?: string | null;
    email?: string | null
    phone?: string | null;
    // password is deliberately absent — it must never be returned to a client.
    cnic?: string | null;
    code?: string | null;
    code_generation_time?: Date | null;
    is_verified?: number | null;
    token?: string | null;
    last_email_sent_at?: Date | null;
    failed_attempts?: number | null;
    lock_until?: Date | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    action_type?: number | null;
  } 
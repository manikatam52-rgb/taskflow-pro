/** Safe user shape sent to clients — never includes the password hash. */
export interface SafeUser {
  _id: string;
  email: string;
  name: string;
  createdAt: Date;
}

/** Row shape as stored in PostgreSQL. */
export interface UserRow {
  id: string;
  email: string;
  password: string;
  name: string | null;
  created_at: Date;
}

/** Returns only safe fields. Password hash is never sent to the client. */
export function toSafeUser(row: UserRow): SafeUser {
  return {
    _id: row.id,
    email: row.email,
    name: row.name ?? "",
    createdAt: row.created_at,
  };
}

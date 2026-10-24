/** Jest mock for the native EncryptedStorage module (in-memory fallback). */
let store: Record<string, string> = {};

const EncryptedStorage = {
  setItem: jest.fn(async (key: string, value: string) => {
    store[key] = value;
  }),
  getItem: jest.fn(async (key: string) => store[key] ?? null),
  removeItem: jest.fn(async (key: string) => {
    delete store[key];
  }),
  clear: jest.fn(async () => {
    store = {};
  }),
};

export default EncryptedStorage;

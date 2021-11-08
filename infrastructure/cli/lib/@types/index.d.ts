/**
 * Makes particular properties of a type possibly-undefined.
 * For example, `Optional<Error, 'message'>` makes the message property optional,
 * but the name property remains required.
 */
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>

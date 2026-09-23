/** Internal UUID provided by the future identity adapter. Never a phone number. */
export type UserId = string & { readonly __brand: 'UserId' };

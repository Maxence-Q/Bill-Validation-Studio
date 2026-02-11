import Cookies from 'js-cookie'

export const CookieManager = {
    /**
     * Set a cookie
     * @param name - Cookie name
     * @param value - Cookie value
     * @param options - Cookie attributes (expires in days, path, secure, etc.)
     */
    set: (
        name: string,
        value: string,
        options?: Cookies.CookieAttributes
    ): void => {
        Cookies.set(name, value, {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            ...options,
        })
    },

    /**
     * Get a cookie value
     * @param name - Cookie name
     * @returns The value of the cookie or undefined
     */
    get: (name: string): string | undefined => {
        return Cookies.get(name)
    },

    /**
     * Get all cookies
     * @returns An object with all cookies
     */
    getAll: (): { [key: string]: string } => {
        return Cookies.get()
    },

    /**
     * Remove a cookie
     * @param name - Cookie name
     * @param options - Cookie attributes
     */
    remove: (name: string, options?: Cookies.CookieAttributes): void => {
        Cookies.remove(name, options)
    },
}

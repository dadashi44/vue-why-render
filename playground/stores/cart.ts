import { defineStore } from 'pinia'

/** Корзина для проверки причин со стором: панель должна назвать стор, поле и экшен. */
export const useCart = defineStore('cart', {
    state: () => ({ items: [] as string[], total: 0 }),
    actions: {
        add(title: string, price: number) {
            this.items.push(title)
            this.total += price
        },
        clear() {
            this.items = []
            this.total = 0
        },
    },
})

import { defineStore } from 'pinia'

export const useCart = defineStore('cart', {
    state: () => ({ items: [] as string[] }),
    actions: {
        add(title: string) {
            this.items.push(title)
        },
    },
})

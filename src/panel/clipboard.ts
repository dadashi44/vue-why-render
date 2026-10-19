/**
 * Скопировать текст. `navigator.clipboard` есть не везде: без HTTPS и не
 * на localhost его нет вовсе, а дев-сервер по IP из локальной сети — частый
 * случай. Тогда откатываемся на textarea и `execCommand`: устарел, но работает.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    }
    catch {
        // Отказ в доступе — пробуем запасной путь.
    }

    if (typeof document === 'undefined') return false
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0' })
    document.body.appendChild(area)
    area.select()
    try {
        return document.execCommand('copy')
    }
    catch {
        return false
    }
    finally {
        area.remove()
    }
}

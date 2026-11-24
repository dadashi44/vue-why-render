/**
 * Фейковый WebSocket для тестов моста: запоминает отправленные сообщения
 * и позволяет вручную открыть соединение / принять сообщение / закрыть.
 */
export class FakeWebSocket {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3

    /** Все созданные экземпляры — в порядке создания. */
    static instances: FakeWebSocket[] = []

    static reset(): void {
        FakeWebSocket.instances = []
    }

    readyState = FakeWebSocket.CONNECTING
    /** Отправленные сообщения (уже распарсенный JSON). */
    sent: unknown[] = []

    onopen: (() => void) | null = null
    onmessage: ((e: { data: unknown }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null

    constructor(readonly url: string) {
        FakeWebSocket.instances.push(this)
    }

    send(data: string): void {
        this.sent.push(JSON.parse(data))
    }

    close(): void {
        this.readyState = FakeWebSocket.CLOSED
        this.onclose?.()
    }

    /** Сервер принял соединение. */
    open(): void {
        this.readyState = FakeWebSocket.OPEN
        this.onopen?.()
    }

    /** Сервер прислал сообщение (объект сериализуется в JSON). */
    receive(data: unknown): void {
        this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) })
    }
}

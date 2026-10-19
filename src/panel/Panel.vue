<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { Scanner } from '../core/scanner'
import { getMessages } from '../i18n'
import type { Registry, TreeNode } from '../core/registry'
import type { ComponentRecord } from '../types'
import { throttle } from '../utils/throttle'
import {
    averageDuration,
    copyText,
    formatDuration,
    formatHint,
    formatPropChange,
    formatReason,
    matchesQuery,
    shortFile,
    whyLines,
} from './format'
import { hintsForRecord } from '../core/hints'
import { EDITOR_HELP, requestOpenInEditor } from './open-in-editor'
import { componentKey, createReport, downloadReport, parseReport } from '../core/report'
import type { Report } from '../core/report'
import { registryFromReport } from '../core/import'
import { formatReportMarkdown } from '../core/markdown'
import { copyToClipboard } from './clipboard'
import { clampPosition, loadPosition, savePosition } from './position'
import type { PanelPosition } from './position'

const props = defineProps<{ scanner: Scanner }>()

type Tab = 'top' | 'slow' | 'tree' | 'events'

// Локаль задаётся один раз при подключении и не меняется на лету,
// поэтому словарь берём сразу, без реактивной обёртки.
const t = getMessages(props.scanner.options.locale)

const collapsed = ref(false)
const tab = ref<Tab>('top')
const query = ref('')
// Открытый отчёт. Пока он есть, панель читает его реестр вместо живого,
// а живой продолжает писать в фоне — возврат к нему ничего не теряет.
const viewing = shallowRef<{ report: Report, registry: Registry } | null>(null)
const source = computed<Registry>(() => viewing.value?.registry ?? props.scanner.registry)

const snapshot = shallowRef(props.scanner.registry.snapshot())
const tree = shallowRef<TreeNode[]>([])

let unsubscribe: (() => void) | null = null

const refresh = throttle(() => {
    snapshot.value = source.value.snapshot()
    if (tab.value === 'tree') tree.value = source.value.tree()
}, props.scanner.options.flushInterval)

/**
 * Снять снимок сразу. `refresh.flush()` здесь не годится: он выполняет только
 * отложенный вызов, а при смене источника реестр ничего не сообщал — и
 * откладывать нечего. Без этого шапка показывала бы цифры прежнего источника.
 */
function sync(): void {
    refresh.cancel()
    snapshot.value = source.value.snapshot()
    if (tab.value === 'tree') tree.value = source.value.tree()
}

onMounted(() => {
    unsubscribe = props.scanner.registry.subscribe(refresh)
    refresh()
    keepInView()
    window.addEventListener('resize', keepInView, { passive: true })
    // Панель растёт вверх вместе со списком: стоящая высоко, она уводила бы
    // шапку за верхний край — а за шапку её и тащат обратно.
    if (typeof ResizeObserver !== 'undefined' && root.value) {
        sizeObserver = new ResizeObserver(keepInView)
        sizeObserver.observe(root.value)
    }
})

onBeforeUnmount(() => {
    refresh.cancel()
    unsubscribe?.()
    window.removeEventListener('resize', keepInView)
    sizeObserver?.disconnect()
    if (copiedTimer) clearTimeout(copiedTimer)
    if (markdownTimer) clearTimeout(markdownTimer)
    if (importErrorTimer) clearTimeout(importErrorTimer)
})

// Пауза живёт в реестре: её переключают и горячая клавиша, и handle.pause().
// Своё состояние в панели расходилось бы с ними, поэтому читаем оттуда.
const paused = computed(() => {
    void snapshot.value
    return props.scanner.registry.isPaused()
})

const sampleLabel = computed(() => {
    const rate = props.scanner.options.sampleRate
    return rate < 1 ? `${t.sampled} ${Math.round(rate * 100)}%` : ''
})

const pauseTitle = computed(() => {
    const hotkey = props.scanner.options.pauseHotkey
    return hotkey ? `${t.pauseTitle} (${hotkey})` : t.pauseTitle
})

// Реестр намеренно нереактивный, поэтому реактивную зависимость даёт snapshot:
// без обращения к нему список пересчитается только при смене фильтра.
const topRecords = computed<ComponentRecord[]>(() => {
    void snapshot.value
    return source.value.top(50).filter(record => matchesQuery(record, query.value))
})

const slowRecords = computed<ComponentRecord[]>(() => {
    void snapshot.value
    return source.value.slowest(50).filter(record => matchesQuery(record, query.value))
})

const flatTree = computed<TreeNode[]>(() => {
    void snapshot.value
    const out: TreeNode[] = []
    const walk = (nodes: TreeNode[]): void => {
        for (const node of [...nodes].sort((a, b) => b.subtreeRenders - a.subtreeRenders)) {
            if (matchesQuery(node, query.value) || node.children.length > 0) out.push(node)
            walk(node.children)
        }
    }
    walk(tree.value)
    return out
})

const events = computed(() => [...snapshot.value.events].reverse().slice(0, 100))

const summary = computed(() => {
    // У отчёта своя длительность: «сейчас минус начало» для него — время с момента записи.
    const seconds = viewing.value
        ? Math.max(0.001, viewing.value.report.meta.durationMs / 1000)
        : Math.max(1, (Date.now() - snapshot.value.startedAt) / 1000)
    return {
        renders: snapshot.value.totalRenders,
        components: snapshot.value.totalComponents,
        perSecond: (snapshot.value.totalRenders / seconds).toFixed(1),
    }
})

function selectTab(next: Tab): void {
    tab.value = next
    if (next === 'tree') tree.value = source.value.tree()
}

function togglePause(): void {
    props.scanner.registry.setPaused(!props.scanner.registry.isPaused())
}

/** Превышен ли бюджет у компонента — счётчик тогда красный. */
function overBudget(record: ComponentRecord): boolean {
    return source.value.hasViolation(componentKey(record))
}

/** Подсказки по строке списка. Пустой массив — значит сказать нечего. */
function hintLines(record: ComponentRecord): string[] {
    // У отчёта свои trackProps/trackReasons: подсказки зависят от того,
    // за чем смотрели при записи, а не от настроек текущей панели.
    const options = viewing.value?.report.meta.options ?? props.scanner.options
    return hintsForRecord(record, options).map(hint => formatHint(hint, t))
}

/** Отчёт того, что сейчас на экране: открытый — как есть, живой — снимком. */
function currentReport(): Report {
    return viewing.value?.report
        ?? createReport({ registry: props.scanner.registry, options: props.scanner.options })
}

function saveReport(): void {
    downloadReport(currentReport())
}

const importError = ref('')
let importErrorTimer: ReturnType<typeof setTimeout> | null = null
const fileInput = ref<HTMLInputElement | null>(null)
const dropping = ref(false)

function showImportError(message: string): void {
    importError.value = message
    if (importErrorTimer) clearTimeout(importErrorTimer)
    importErrorTimer = setTimeout(() => {
        importError.value = ''
        importErrorTimer = null
    }, 5000)
}

/** Текст файла. `Blob.text()` есть не везде — во вебвью и jsdom его нет, FileReader есть. */
function readText(file: Blob): Promise<string> {
    if (typeof file.text === 'function') return file.text()
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error ?? new Error('read failed'))
        reader.readAsText(file)
    })
}

/** Открыть отчёт. Битый файл — строка с ошибкой, а не падение панели. */
async function openReportFile(file: File): Promise<void> {
    try {
        const report = parseReport(await readText(file))
        viewing.value = { report, registry: registryFromReport(report) }
        importError.value = ''
        sync()
    }
    catch (error) {
        showImportError(`${t.importFailed}: ${(error as Error).message.replace(/^\[vue-why-render\] /, '')}`)
    }
}

function onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    // Сбрасываем значение, иначе повторный выбор того же файла не даст change.
    input.value = ''
    if (file) void openReportFile(file)
}

function hasFiles(event: DragEvent): boolean {
    return Boolean(event.dataTransfer?.types && Array.from(event.dataTransfer.types).includes('Files'))
}

function onDragOver(event: DragEvent): void {
    if (!hasFiles(event)) return
    event.preventDefault()
    dropping.value = true
}

function onDrop(event: DragEvent): void {
    dropping.value = false
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    event.preventDefault()
    void openReportFile(file)
}

function backToLive(): void {
    viewing.value = null
    sync()
}

const viewingLabel = computed(() => {
    if (!viewing.value) return ''
    const { meta } = viewing.value.report
    const stamp = new Date(meta.createdAt).toLocaleString()
    return `${t.viewingReport} · ${stamp} · vue-why-render ${meta.package} · Vue ${meta.vue}`
})

const markdownCopied = ref(false)
let markdownTimer: ReturnType<typeof setTimeout> | null = null

function copyMarkdown(): void {
    const report = currentReport()
    // Блок всегда английский, даже при русской панели: заголовки таблиц
    // и так английские, а смесь языков в одном issue читается хуже обоих.
    void copyToClipboard(formatReportMarkdown(report))
        .then((copied) => {
            if (!copied) return
            markdownCopied.value = true
            if (markdownTimer) clearTimeout(markdownTimer)
            markdownTimer = setTimeout(() => {
                markdownCopied.value = false
                markdownTimer = null
            }, 1200)
        })
}

function reset(): void {
    props.scanner.registry.reset()
    tree.value = props.scanner.registry.tree()
    refresh.flush()
}

const copiedUid = ref<number | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

function copyReason(record: ComponentRecord): void {
    void copyToClipboard(copyText(record, t)).then((copied) => {
        if (!copied) return
        copiedUid.value = record.uid
        if (copiedTimer) clearTimeout(copiedTimer)
        copiedTimer = setTimeout(() => {
            copiedUid.value = null
            copiedTimer = null
        }, 1200)
    })
}

// Перетаскивание за шапку. Позиция — отступ от правого нижнего угла, как и
// в исходном положении: тогда свёрнутая панель сжимается к тому же углу.
const root = ref<HTMLElement | null>(null)
const position = ref<PanelPosition | null>(loadPosition())
const DRAG_THRESHOLD = 4
let sizeObserver: ResizeObserver | null = null

let drag: { x: number, y: number, from: PanelPosition, moved: boolean } | null = null
// Отпускание после перетаскивания браузер считает кликом по шапке —
// без этого флага каждый перенос заодно сворачивал бы панель.
let suppressClick = false

const panelStyle = computed(() => position.value
    ? { right: `${position.value.right}px`, bottom: `${position.value.bottom}px` }
    : undefined)

function panelSize(): { width: number, height: number } {
    const rect = root.value?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
}

function viewport(): { width: number, height: number } {
    return { width: window.innerWidth, height: window.innerHeight }
}

function keepInView(): void {
    if (!position.value) return
    position.value = clampPosition(position.value, panelSize(), viewport())
}

function onHeadPointerDown(event: PointerEvent): void {
    suppressClick = false
    if (event.button !== 0 || !root.value) return
    const rect = root.value.getBoundingClientRect()
    drag = {
        x: event.clientX,
        y: event.clientY,
        from: { right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom },
        moved: false,
    }
    ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
}

function onHeadPointerMove(event: PointerEvent): void {
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    drag.moved = true
    position.value = clampPosition(
        { right: drag.from.right - dx, bottom: drag.from.bottom - dy },
        panelSize(),
        viewport(),
    )
}

function onHeadPointerUp(): void {
    if (drag?.moved && position.value) {
        suppressClick = true
        savePosition(position.value)
    }
    drag = null
}

function onHeadClick(): void {
    if (suppressClick) {
        suppressClick = false
        return
    }
    collapsed.value = !collapsed.value
    // Развёрнутая у верхнего края панель иначе уезжает за экран.
    void nextTick(keepInView)
}

// Подсказку показываем один раз за сессию: по строкам кликают часто,
// а совет от повторения не улучшается.
let warnedAboutEditor = false

function openInEditor(record: ComponentRecord): void {
    if (!record.file) return

    void requestOpenInEditor(record.file, props.scanner.options.openInEditorUrl)
        .then((opened) => {
            if (opened || warnedAboutEditor) return
            warnedAboutEditor = true
            console.warn(EDITOR_HELP)
        })
}

</script>

<template>
    <div
        ref="root"
        class="vwr"
        :class="[`vwr--${props.scanner.options.theme}`, { 'vwr--collapsed': collapsed, 'vwr--dropping': dropping }]"
        :style="panelStyle"
        @dragover="onDragOver"
        @dragleave="dropping = false"
        @drop="onDrop"
    >
        <div
            class="vwr__head"
            @click="onHeadClick()"
            @pointerdown="onHeadPointerDown"
            @pointermove="onHeadPointerMove"
            @pointerup="onHeadPointerUp()"
            @pointercancel="onHeadPointerUp()"
        >
            <span class="vwr__title">why-render</span>
            <span class="vwr__badge">{{ summary.renders }}</span>
            <span class="vwr__spacer" />
            <span v-if="sampleLabel" class="vwr__stat">{{ sampleLabel }}</span>
            <span class="vwr__stat">{{ summary.perSecond }}/s · {{ summary.components }} {{ t.components }}</span>
            <span class="vwr__stat">{{ collapsed ? '▲' : '▼' }}</span>
        </div>

        <div v-if="!collapsed" class="vwr__body">
            <div class="vwr__tabs">
                <button
                    class="vwr__tab"
                    :class="{ 'vwr__tab--active': tab === 'top' }"
                    @click="selectTab('top')"
                >
                    {{ t.tabTop }}
                </button>
                <button
                    class="vwr__tab"
                    :class="{ 'vwr__tab--active': tab === 'slow' }"
                    @click="selectTab('slow')"
                >
                    {{ t.tabSlow }}
                </button>
                <button
                    class="vwr__tab"
                    :class="{ 'vwr__tab--active': tab === 'tree' }"
                    @click="selectTab('tree')"
                >
                    {{ t.tabTree }}
                </button>
                <button
                    class="vwr__tab"
                    :class="{ 'vwr__tab--active': tab === 'events' }"
                    @click="selectTab('events')"
                >
                    {{ t.tabEvents }}
                </button>
            </div>

            <div v-if="viewing" class="vwr__banner">
                <span class="vwr__banner-text" :title="viewingLabel">📄 {{ viewingLabel }}</span>
                <button class="vwr__btn" @click="backToLive()">
                    {{ t.backToLive }}
                </button>
            </div>
            <div v-if="importError" class="vwr__error">
                {{ importError }}
            </div>

            <div class="vwr__toolbar">
                <input v-model="query" class="vwr__search" type="search" :placeholder="t.searchPlaceholder">
                <!-- Запись и сброс относятся к живой сессии, к открытому отчёту — нет. -->
                <template v-if="!viewing">
                    <button
                        class="vwr__btn"
                        :class="{ 'vwr__btn--on': paused }"
                        :title="pauseTitle"
                        @click="togglePause()"
                    >
                        {{ paused ? t.paused : t.recording }}
                    </button>
                    <button class="vwr__btn" @click="reset()">
                        {{ t.reset }}
                    </button>
                </template>
                <button class="vwr__btn" @click="saveReport()">
                    {{ t.saveReport }}
                </button>
                <button class="vwr__btn" :title="t.copyMarkdownTitle" @click="copyMarkdown()">
                    {{ markdownCopied ? '✓' : t.copyMarkdown }}
                </button>
                <button class="vwr__btn" :title="t.openReportTitle" @click="fileInput?.click()">
                    {{ t.openReport }}
                </button>
                <input
                    ref="fileInput"
                    class="vwr__file"
                    type="file"
                    accept=".json,application/json"
                    @change="onFilePicked"
                >
            </div>

            <ul v-if="tab === 'top' || tab === 'slow'" class="vwr__list">
                <li v-if="(tab === 'top' ? topRecords : slowRecords).length === 0" class="vwr__empty">
                    {{ t.emptyRenders }}
                </li>
                <li v-for="record in tab === 'top' ? topRecords : slowRecords" :key="record.uid">
                    <div class="vwr__line">
                        <button class="vwr__row" :title="record.file" @click="openInEditor(record)">
                            <span class="vwr__name">
                                {{ record.name }}
                                <span class="vwr__dim">{{ shortFile(record.file) }}</span>
                            </span>
                            <span
                                class="vwr__count"
                                :class="{ 'vwr__count--over': overBudget(record) }"
                            >×{{ record.renderCount }}</span>
                            <span class="vwr__time">{{ formatDuration(averageDuration(record)) }}</span>
                        </button>
                        <button
                            v-if="whyLines(record, t).length"
                            class="vwr__copy"
                            :title="copiedUid === record.uid ? t.copied : t.copyReason"
                            :aria-label="t.copyReason"
                            @click="copyReason(record)"
                        >
                            {{ copiedUid === record.uid ? '✓' : '⧉' }}
                        </button>
                        <!-- Пустое место под кнопку: иначе колонка времени гуляет от строки к строке. -->
                        <span v-else class="vwr__copy vwr__copy--empty" aria-hidden="true">⧉</span>
                    </div>
                    <span
                        v-for="(line, index) in whyLines(record, t)"
                        :key="index"
                        class="vwr__why"
                    >{{ line }}</span>
                    <span
                        v-for="(line, index) in hintLines(record)"
                        :key="`h${index}`"
                        class="vwr__why vwr__why--hint"
                    >💡 {{ line }}</span>
                </li>
            </ul>

            <ul v-else-if="tab === 'tree'" class="vwr__list">
                <li v-if="viewing" class="vwr__empty">
                    {{ t.treeNotInReport }}
                </li>
                <li v-else-if="flatTree.length === 0" class="vwr__empty">
                    {{ t.emptyTree }}
                </li>
                <li v-for="node in (viewing ? [] : flatTree)" :key="node.uid">
                    <button class="vwr__row" :title="node.file" @click="openInEditor(node)">
                        <span class="vwr__name">
                            <span class="vwr__tree-indent">{{ '│ '.repeat(node.depth) }}</span>
                            {{ node.name }}
                        </span>
                        <span class="vwr__count">×{{ node.renderCount }}</span>
                        <span class="vwr__time">Σ{{ node.subtreeRenders }}</span>
                    </button>
                </li>
            </ul>

            <ul v-else class="vwr__list">
                <li v-if="events.length === 0" class="vwr__empty">
                    {{ t.emptyEvents }}
                </li>
                <li v-for="(event, index) in events" :key="`${event.uid}-${event.timestamp}-${index}`" class="vwr__event">
                    <div class="vwr__event-head">
                        <span class="vwr__name">{{ event.name }}</span>
                        <span class="vwr__dim">{{ event.phase }}</span>
                        <span class="vwr__time">{{ formatDuration(event.duration) }}</span>
                    </div>
                    <span v-for="(reason, reasonIndex) in event.reasons" :key="reasonIndex" class="vwr__why">
                        {{ formatReason(reason, t) }}
                    </span>
                    <span
                        v-for="(change, changeIndex) in event.propChanges"
                        :key="`p${changeIndex}`"
                        class="vwr__why vwr__why--prop"
                    >{{ formatPropChange(change, t) }}</span>
                </li>
            </ul>
        </div>
    </div>
</template>

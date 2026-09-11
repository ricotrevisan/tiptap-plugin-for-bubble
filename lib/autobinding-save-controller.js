// Bubble updates the bound property optimistically. It is not a server ACK.
// Keep the current document authoritative over our own older publications and
// reconcile a late stale response with one coalesced corrective write.
export function createAutobindingSaveController({
    getContent, getDelay, isActive, publish, notify,
    setTimer = setTimeout, clearTimer = clearTimeout,
}) {
    let bindingId;
    let boundContent;
    let lastNotified;
    let generation = 0;
    let timer = null;
    let pending = false;
    let changedByUser = false;
    const publications = new Set();
    const normalize = value => typeof value === "string" ? value : "";

    // Compact, non-security fingerprints avoid retaining a full document for
    // every publication during a long editing session. Cleared on record switch.
    function fingerprint(value) {
        const text = normalize(value);
        let a = 0x811c9dc5, b = 0x9e3779b9, c = 0x85ebca6b, d = 0xc2b2ae35;
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            a = Math.imul(a ^ code, 16777619);
            b = Math.imul(b ^ code, 2246822519);
            c = Math.imul(c ^ code, 3266489917);
            d = Math.imul(d ^ code, 668265263);
        }
        return `${text.length}:${a >>> 0}:${b >>> 0}:${c >>> 0}:${d >>> 0}`;
    }

    function cancel() {
        clearTimer(timer);
        timer = null;
        pending = false;
        changedByUser = false;
        generation++;
    }

    function schedule(delay) {
        clearTimer(timer);
        pending = true;
        const scheduledGeneration = generation;
        timer = setTimer(() => {
            if (scheduledGeneration === generation) flush();
        }, delay);
    }

    function flush() {
        if (!pending) return;
        if (!isActive()) { cancel(); return; }
        // Read at dispatch, rather than closing over a snapshot from a keystroke.
        const content = getContent();
        const shouldNotify = changedByUser && content !== lastNotified;
        const dispatchGeneration = generation;
        clearTimer(timer);
        timer = null;
        pending = false;
        changedByUser = false;
        // Settle before calling Bubble: publication can synchronously re-enter
        // receive(), and a workflow can switch records or queue another edit.
        if (shouldNotify) lastNotified = content;
        if (content !== boundContent) {
            publications.add(fingerprint(content));
            publish(content);
        }
        if (shouldNotify && generation === dispatchGeneration) notify();
    }

    function classify(id, value) {
        if ((id || "") !== bindingId) return "record";
        if (publications.has(fingerprint(value))) return "echo";
        return normalize(value) !== boundContent ? "external" : "unchanged";
    }

    function receive(id, value) {
        const kind = classify(id, value);
        bindingId = id || "";
        boundContent = normalize(value);
        if (kind === "record" || kind === "external") {
            cancel();
            if (kind === "record") publications.clear();
            lastNotified = boundContent;
        } else if (kind === "echo" && isActive() && boundContent !== getContent()) {
            // Do not postpone a user's existing quiet-period timer. If typing
            // has already settled, group stale responses into one repair. A
            // matching optimistic echo never cancels a pending save or proves
            // that earlier server requests have finished.
            if (!pending) schedule(250);
        }
        return kind;
    }

    function edit() {
        changedByUser = true;
        const configured = getDelay();
        const delay = Number.isFinite(configured) ? Math.max(0, configured) : 2200;
        schedule(delay);
    }

    return {
        classify, receive, edit, flush, cancel,
        get pending() { return pending; },
        get bindingId() { return bindingId; },
        get boundContent() { return boundContent; },
        // A schema rebuild of the same record must preserve a queued edit or
        // repair. A real record replacement must cancel it instead.
        checkpoint() { return pending ? { changedByUser } : null; },
        resume(checkpoint) {
            if (!checkpoint) return;
            changedByUser = checkpoint.changedByUser;
            const delay = getDelay();
            schedule(Number.isFinite(delay) ? Math.max(0, delay) : 2200);
        },
    };
}

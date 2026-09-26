// In-memory stand-in for the Liveblocks service. It implements the room surface
// used by the real LiveblocksYjsProvider (status/others/ydoc events, presence,
// Yjs fetch/update), so tests exercise the installed provider end to end.
// btoa/atob exist in Node and browsers, so the lifecycle lab can load this too.
const b64 = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
const unb64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));

function eventSource() {
    const listeners = new Set();
    const everSubscribed = new Set();
    return {
        // Simulates a callback that was already queued when it was unsubscribed.
        deliverLate(value) { [...everSubscribed].forEach(listener => listener(value)); },
        subscribe(listener) {
            listeners.add(listener);
            everSubscribed.add(listener);
            return () => listeners.delete(listener);
        },
        notify(value) { [...listeners].forEach(listener => listener(value)); },
        get size() { return listeners.size; },
    };
}

// Pass the bundle's Yjs (window.tiptap.Y) to avoid loading a second copy.
export function createFakeLiveblocks(Y) {
    const rooms = new Map();
    const sessions = new Set();
    let nextConnectionId = 1;
    const server = {
        sessions,
        history: [],
        entered: 0,
        left: 0,
        holdSync: false,
        heldSyncs: [],
        // `id` is "<public key>/<room id>".
        roomDocument(id) {
            if (!rooms.has(id)) rooms.set(id, new Y.Doc());
            return rooms.get(id);
        },
        sessionsIn(id) { return [...sessions].filter(session => session.roomId === id); },
        // Deliver fetch responses postponed while holdSync was set.
        flushSync() {
            server.holdSync = false;
            server.heldSyncs.splice(0).forEach(respond => respond());
        },
        createClient({ publicApiKey }) {
            if (!publicApiKey) throw new Error("publicApiKey required");
            // Rooms belong to the project identified by the public key.
            return { enterRoom: (id, options) => enterRoom(publicApiKey + "/" + id, options) };
        },
    };

    function others(session) {
        return server.sessionsIn(session.roomId)
            .filter(other => other !== session && other.status === "connected")
            .map(other => ({ connectionId: other.connectionId, presence: other.presence }));
    }

    function broadcastOthers(session, type) {
        const user = { connectionId: session.connectionId, presence: session.presence };
        for (const other of server.sessionsIn(session.roomId)) {
            if (other !== session && other.status === "connected") {
                other.events.others.notify({ type, user, others: others(other) });
            }
        }
    }

    function enterRoom(roomId, { initialPresence = {} } = {}) {
        const events = { status: eventSource(), others: eventSource(), ydoc: eventSource(),
            myPresence: eventSource(), error: eventSource() };
        const session = { roomId, connectionId: nextConnectionId++, presence: { ...initialPresence },
            status: "initial", events, left: false };
        const setStatus = (status) => {
            if (session.status === status) return;
            session.status = status;
            events.status.notify(status);
        };
        session.connect = () => {
            if (session.left) return;
            setStatus("connected");
            broadcastOthers(session, "enter");
        };
        session.drop = () => {
            if (session.status !== "connected") return;
            setStatus("reconnecting");
            broadcastOthers(session, "leave");
        };
        sessions.add(session);
        server.history.push(session);
        server.entered++;

        const channels = { status: events.status, others: events.others,
            "my-presence": events.myPresence, error: events.error };
        const target = {
            id: roomId,
            events: { status: events.status, others: events.others, ydoc: events.ydoc },
            subscribe(type, listener) {
                if (!channels[type]) throw new Error("unsupported fake room event " + type);
                return channels[type].subscribe(listener);
            },
            getStatus: () => session.status,
            getSelf: () => session.status === "connected"
                ? { connectionId: session.connectionId, presence: session.presence, canWrite: true } : null,
            getPresence: () => session.presence,
            getOthers: () => others(session),
            updatePresence(patch) {
                session.presence = { ...session.presence, ...patch };
                events.myPresence.notify(session.presence);
                broadcastOthers(session, "update");
            },
            updateYDoc(update, guid) {
                if (session.status !== "connected" || guid) return;
                const document = server.roomDocument(roomId);
                Y.applyUpdate(document, unb64(update));
                for (const other of server.sessionsIn(roomId)) {
                    if (other !== session && other.status === "connected") {
                        other.events.ydoc.notify({ type: "server", update, stateVector: null, remoteSnapshotHash: "" });
                    }
                }
            },
            fetchYDoc(vector, guid) {
                if (session.status !== "connected" || guid) return;
                const respond = () => {
                    if (session.status !== "connected") return;
                    const document = server.roomDocument(roomId);
                    events.ydoc.notify({ type: "server",
                        update: b64(Y.encodeStateAsUpdate(document, unb64(vector))),
                        stateVector: b64(Y.encodeStateVector(document)), remoteSnapshotHash: "" });
                };
                if (server.holdSync) server.heldSyncs.push(respond);
                else queueMicrotask(respond);
            },
        };
        // LiveblocksYjsProvider registers itself through a private symbol.
        const room = new Proxy(target, {
            get: (object, key) => typeof key === "symbol" ? { setYjsProvider() {} } : object[key],
        });
        session.room = room;
        setStatus("connecting");
        setTimeout(session.connect, 0);

        const leave = () => {
            if (session.left) throw new Error("room left twice");
            session.left = true;
            server.left++;
            if (session.status === "connected") broadcastOthers(session, "leave");
            setStatus("disconnected");
            sessions.delete(session);
        };
        return { room, leave };
    }
    return server;
}

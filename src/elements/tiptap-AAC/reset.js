if (instance.data.debug) {
    instance.data.debug("reset running");
}

// Use the teardown function if available
if (instance.data.teardownEditor) {
    instance.data.teardownEditor("element reset");
} else {
    // Fallback for legacy cleanup
    if (instance.data._collabRetryTimer) {
        clearTimeout(instance.data._collabRetryTimer);
        instance.data._collabRetryTimer = null;
    }
    if (instance.data._collabSyncPollInterval) {
        clearInterval(instance.data._collabSyncPollInterval);
        instance.data._collabSyncPollInterval = null;
    }
}